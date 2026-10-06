/**
 * Test-Harness für RLS-Tests direkt auf Postgres.
 *
 * Simuliert exakt, was die Supabase-API (PostgREST / Storage) pro Anfrage tut:
 * `SET LOCAL ROLE authenticated` + JWT-Claims in `request.jwt.claims`.
 * Alles läuft in einer Transaktion, die am Ende zurückgerollt wird; jeder
 * Zugriff als Nutzer läuft in einem eigenen Savepoint.
 */
import { Client, type QueryResult } from "pg";

export const DATABASE_URL =
  process.env.DATABASE_URL ?? "postgresql://postgres:postgres@127.0.0.1:54322/postgres";

export type Q = (sql: string, params?: unknown[]) => Promise<QueryResult>;

export class TestDb {
  private client = new Client({ connectionString: DATABASE_URL });
  private zaehler = 0;

  async start() {
    await this.client.connect();
    await this.client.query("begin");
  }

  async stop() {
    try {
      await this.client.query("rollback");
    } finally {
      await this.client.end();
    }
  }

  /**
   * Jede Anweisung läuft in einem eigenen Savepoint: Ein (erwarteter) Fehler
   * bricht so nicht die gesamte Test-Transaktion ab.
   */
  q: Q = async (sql, params) => {
    const sp = `st_${++this.zaehler}`;
    await this.client.query(`savepoint ${sp}`);
    try {
      const r = await this.client.query(sql, params as unknown[]);
      await this.client.query(`release savepoint ${sp}`);
      return r;
    } catch (e) {
      await this.client.query(`rollback to savepoint ${sp}`);
      await this.client.query(`release savepoint ${sp}`);
      throw e;
    }
  };

  /**
   * Führt fn als angemeldeter Nutzer (oder anonym bei null) aus. Alle
   * Änderungen werden danach verworfen, damit Tests sich nicht beeinflussen.
   */
  async als<T>(userId: string | null, fn: (q: Q) => Promise<T>): Promise<T> {
    const sp = `sp_${++this.zaehler}`;
    await this.client.query(`savepoint ${sp}`);
    try {
      if (userId) {
        await this.client.query("set local role authenticated");
        await this.client.query("select set_config('request.jwt.claims', $1, true)", [
          JSON.stringify({ sub: userId, role: "authenticated", aud: "authenticated" }),
        ]);
      } else {
        await this.client.query("set local role anon");
        await this.client.query("select set_config('request.jwt.claims', $1, true)", [
          JSON.stringify({ role: "anon" }),
        ]);
      }
      return await fn(this.q);
    } finally {
      await this.client.query(`rollback to savepoint ${sp}`);
      await this.client.query(`release savepoint ${sp}`);
    }
  }

  /** Wie als(), aber Änderungen bleiben (für mehrstufige Abläufe) */
  async alsBleibend<T>(userId: string, fn: (q: Q) => Promise<T>): Promise<T> {
    const sp = `spb_${++this.zaehler}`;
    await this.client.query(`savepoint ${sp}`);
    try {
      await this.client.query("set local role authenticated");
      await this.client.query("select set_config('request.jwt.claims', $1, true)", [
        JSON.stringify({ sub: userId, role: "authenticated", aud: "authenticated" }),
      ]);
      const ergebnis = await fn(this.q);
      await this.client.query("reset role");
      await this.client.query("select set_config('request.jwt.claims', '', true)");
      await this.client.query(`release savepoint ${sp}`);
      return ergebnis;
    } catch (e) {
      await this.client.query(`rollback to savepoint ${sp}`);
      await this.client.query(`release savepoint ${sp}`);
      throw e;
    }
  }
}

/** Erwartet, dass die Anweisung mit einem Fehler abgelehnt wird. */
export async function erwarteFehler(p: Promise<unknown>, code?: string | string[]) {
  try {
    await p;
  } catch (e) {
    const err = e as { code?: string; message?: string };
    if (code) {
      const codes = Array.isArray(code) ? code : [code];
      if (!codes.includes(err.code ?? "")) {
        throw new Error(`Falscher Fehlercode ${err.code} (erwartet ${codes.join("/")}): ${err.message}`);
      }
    }
    return err;
  }
  throw new Error("Anweisung wurde erwartet abgelehnt zu werden, war aber erfolgreich");
}

/** Erwartet: entweder Fehler oder 0 betroffene Zeilen (RLS filtert still). */
export async function erwarteKeineWirkung(p: Promise<QueryResult>) {
  try {
    const r = await p;
    if (r.rowCount !== 0) {
      throw new Error(`Erwartet keine Wirkung, aber ${r.rowCount} Zeile(n) betroffen`);
    }
  } catch (e) {
    const err = e as Error & { code?: string };
    if (err.message.startsWith("Erwartet keine Wirkung")) throw err;
    // abgelehnt => ok
  }
}
