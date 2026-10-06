/**
 * Mandantentrennung: Kunde A (und Berater ohne Zuordnung) dürfen über die API
 * keinerlei Daten von Kunde B lesen oder schreiben.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, erwarteFehler, erwarteKeineWirkung, type Q } from "./db";
import { fixturesAnlegen, type Fixtures } from "./fixtures";

const db = new TestDb();
let f: Fixtures;

beforeAll(async () => {
  await db.start();
  f = await fixturesAnlegen(db.q);
});
afterAll(() => db.stop());

/** Lese-Abfragen auf alle Daten eines Kunden; jede muss 0 Zeilen liefern */
function leseAbfragen(k: Fixtures["B"]): [string, string, unknown[]][] {
  const c = k.customer;
  return [
    ["customers", "select * from public.customers where id = $1", [c]],
    ["customer_consultants", "select * from public.customer_consultants where customer_id = $1", [c]],
    ["kontingente", "select * from public.kontingente where customer_id = $1 or id = $2", [c, k.kontingent]],
    ["kontingent_warnungen", "select * from public.kontingent_warnungen where customer_id = $1", [c]],
    ["stories", "select * from public.stories where customer_id = $1 or id = $2", [c, k.story]],
    ["tickets", "select * from public.tickets where customer_id = $1 or id = $2", [c, k.ticket]],
    ["time_entries", "select * from public.time_entries where customer_id = $1 or id = $2", [c, k.zeit]],
    ["comments", "select * from public.comments where customer_id = $1 or id in ($2, $3)", [c, k.kommentarStory, k.kommentarTicket]],
    ["approvals", "select * from public.approvals where customer_id = $1 or id = $2", [c, k.approval]],
    ["meetings", "select * from public.meetings where customer_id = $1 or id = $2", [c, k.meeting]],
    ["monatsabschluesse", "select * from public.monatsabschluesse where customer_id = $1", [c]],
    ["storage.objects", "select * from storage.objects where name like $1 || '/%'", [c]],
    ["kontingent_stand", "select * from public.kontingent_stand where customer_id = $1", [c]],
    ["kunden_kennzahlen", "select * from public.kunden_kennzahlen where customer_id = $1", [c]],
    ["offene_kundenkommentare", "select * from public.offene_kundenkommentare where customer_id = $1", [c]],
  ];
}

/** Schreibversuche auf Daten von Kunde B; jeder muss scheitern oder wirkungslos sein */
function schreibVersuche(k: Fixtures["B"], eigenerKunde: string): [string, (q: Q) => Promise<unknown>][] {
  const c = k.customer;
  return [
    ["kontingente insert", (q) => erwarteFehler(q("insert into public.kontingente (customer_id, leistung, stunden) values ($1, 'x', 1)", [c]))],
    ["kontingente update", (q) => erwarteKeineWirkung(q("update public.kontingente set stunden = 999 where id = $1", [k.kontingent]))],
    ["kontingente delete", (q) => erwarteKeineWirkung(q("delete from public.kontingente where id = $1", [k.kontingent]))],
    ["stories insert", (q) => erwarteFehler(q("insert into public.stories (customer_id, titel) values ($1, 'x')", [c]))],
    ["stories update", (q) => erwarteKeineWirkung(q("update public.stories set titel = 'gehackt' where id in ($1, $2)", [k.story, k.storyEntwurf]))],
    ["stories delete", (q) => erwarteKeineWirkung(q("delete from public.stories where id in ($1, $2)", [k.story, k.storyEntwurf]))],
    ["tickets insert", (q) => erwarteFehler(q("insert into public.tickets (customer_id, titel) values ($1, 'x')", [c]))],
    ["tickets update", (q) => erwarteKeineWirkung(q("update public.tickets set titel = 'gehackt' where id = $1", [k.ticket]))],
    ["tickets delete", (q) => erwarteKeineWirkung(q("delete from public.tickets where id = $1", [k.ticket]))],
    ["time_entries insert", (q) => erwarteFehler(q("insert into public.time_entries (customer_id, datum, dauer_stunden, kategorie) values ($1, current_date, 1, 'beratung')", [c]))],
    ["time_entries update", (q) => erwarteKeineWirkung(q("update public.time_entries set dauer_stunden = 9 where id = $1", [k.zeit]))],
    ["time_entries delete", (q) => erwarteKeineWirkung(q("delete from public.time_entries where id = $1", [k.zeit]))],
    ["comments insert (Kunde B)", (q) => erwarteFehler(q("insert into public.comments (customer_id, story_id, text) values ($1, $2, 'x')", [c, k.story]))],
    ["comments insert (eigener Kunde, fremde Story)", (q) => erwarteFehler(q("insert into public.comments (customer_id, story_id, text) values ($1, $2, 'x')", [eigenerKunde, k.story]))],
    ["comments insert (eigener Kunde, fremdes Ticket)", (q) => erwarteFehler(q("insert into public.comments (customer_id, ticket_id, text) values ($1, $2, 'x')", [eigenerKunde, k.ticket]))],
    ["comments delete", (q) => erwarteKeineWirkung(q("delete from public.comments where id in ($1, $2)", [k.kommentarStory, k.kommentarTicket]))],
    ["meetings insert", (q) => erwarteFehler(q("insert into public.meetings (customer_id, datum, titel) values ($1, current_date, 'x')", [c]))],
    ["meetings update", (q) => erwarteKeineWirkung(q("update public.meetings set transkript = 'x' where id = $1", [k.meeting]))],
    ["meetings delete", (q) => erwarteKeineWirkung(q("delete from public.meetings where id = $1", [k.meeting]))],
    ["approvals insert", (q) => erwarteFehler(q("insert into public.approvals (customer_id, story_id, aktion, nach_status) values ($1, $2, 'x', 'abgenommen')", [c, k.story]))],
    ["customers update", (q) => erwarteKeineWirkung(q("update public.customers set firmenname = 'x' where id = $1", [c]))],
    ["customers delete", (q) => erwarteKeineWirkung(q("delete from public.customers where id = $1", [c]))],
    ["customer_consultants insert", (q) => erwarteFehler(q("insert into public.customer_consultants (customer_id, berater_id) values ($1, auth.uid())", [c]))],
    ["storage insert", (q) => erwarteFehler(q("insert into storage.objects (bucket_id, name) values ('transkripte', $1)", [`${c}/${k.meeting}/neu.txt`]))],
    ["storage update", (q) => erwarteKeineWirkung(q("update storage.objects set metadata = '{}' where name = $1", [k.datei]))],
    ["storage delete", (q) => erwarteKeineWirkung(q("delete from storage.objects where name = $1", [k.datei]))],
    ["rpc story_transition", (q) => erwarteFehler(q("select public.story_transition($1, 'zur_umsetzung_freigegeben')", [k.story]))],
    ["rpc story_transition (Ablehnung)", (q) => erwarteFehler(q("select public.story_transition($1, 'entwurf', 'abgelehnt')", [k.story]))],
    ["rpc ticket_in_story_umwandeln", (q) => erwarteFehler(q("select public.ticket_in_story_umwandeln($1)", [k.ticket]))],
    ["rpc monat_abschliessen", (q) => erwarteFehler(q("select public.monat_abschliessen($1, '2020-02')", [c]))],
    ["rpc monat_wiedereroeffnen", (q) => erwarteFehler(q("select public.monat_wiedereroeffnen($1, '2020-01', 'x')", [c]))],
    ["rpc kunde_login_wechseln", (q) => erwarteFehler(q("select public.kunde_login_wechseln($1, auth.uid())", [c]))],
  ];
}

const akteure = () =>
  [
    ["Kunde A", f.kundeA, f.A.customer],
    ["Berater ohne Zuordnung", f.beraterOhne, f.A.customer],
    ["Berater von A", f.beraterA, f.A.customer],
  ] as const;

describe("Positivkontrolle: eigene Daten sind sichtbar", () => {
  it("Kunde A sieht seine eigenen Daten in allen Tabellen", async () => {
    await db.als(f.kundeA, async (q) => {
      for (const [tabelle, sql, params] of leseAbfragen(f.A)) {
        if (["customer_consultants", "kontingent_warnungen", "monatsabschluesse", "offene_kundenkommentare"].includes(tabelle)) continue;
        const r = await q(sql, params);
        expect(r.rowCount, `Kunde A sollte eigene ${tabelle} sehen`).toBeGreaterThan(0);
      }
    });
  });

  it("Berater von A sieht die Daten von A", async () => {
    await db.als(f.beraterA, async (q) => {
      for (const [tabelle, sql, params] of leseAbfragen(f.A)) {
        if (["customer_consultants", "kontingent_warnungen"].includes(tabelle)) continue;
        const r = await q(sql, params);
        expect(r.rowCount, `Berater A sollte ${tabelle} von A sehen`).toBeGreaterThan(0);
      }
    });
  });
});

describe.each([
  ["Kunde A"],
  ["Berater ohne Zuordnung"],
  ["Berater von A"],
])("%s → Daten von Kunde B", (name) => {
  const akteur = () => akteure().find((a) => a[0] === name)!;

  it("kann keine Daten von Kunde B lesen", async () => {
    await db.als(akteur()[1], async (q) => {
      for (const [tabelle, sql, params] of leseAbfragen(f.B)) {
        const r = await q(sql, params);
        expect(r.rowCount, `${name} darf ${tabelle} von B nicht sehen`).toBe(0);
      }
    });
  });

  it("kann keine Daten von Kunde B schreiben, ändern oder löschen", async () => {
    for (const [versuch, fn] of schreibVersuche(f.B, akteur()[2])) {
      await db.als(akteur()[1], async (q) => {
        try {
          await fn(q);
        } catch (e) {
          throw new Error(`${name} / ${versuch}: ${(e as Error).message}`);
        }
      });
    }
  });

  it("kann keine Profile von Kunde B sehen und keine Benachrichtigungen von B", async () => {
    await db.als(akteur()[1], async (q) => {
      expect((await q("select * from public.profiles where id = $1", [f.kundeB])).rowCount).toBe(0);
      expect((await q("select * from public.notifications where user_id = $1", [f.kundeB])).rowCount).toBe(0);
    });
  });

  it("kann eigene Datensätze nicht zu Kunde B verschieben", async () => {
    await db.als(akteur()[1], async (q) => {
      for (const [tabelle, id] of [
        ["stories", f.A.storyEntwurf],
        ["time_entries", f.A.zeit],
        ["meetings", f.A.meeting],
        ["kontingente", f.A.kontingent],
      ]) {
        await erwarteKeineWirkung(q(`update public.${tabelle} set customer_id = $1 where id = $2`, [f.B.customer, id]));
      }
    });
    // Und die Daten von B sind nach allen Versuchen unverändert
    const r = await db.q("select titel from public.stories where id = $1", [f.B.story]);
    expect(r.rows[0].titel).toBe("Story B");
  });
});

describe("Kunde A sieht keine internen Daten", () => {
  it("keine Monatsabschlüsse, keine Kontingentwarnungen, kein Audit-Log, keine E-Mail-Warteschlange", async () => {
    await db.als(f.kundeA, async (q) => {
      expect((await q("select * from public.monatsabschluesse")).rowCount).toBe(0);
      expect((await q("select * from public.kontingent_warnungen")).rowCount).toBe(0);
      expect((await q("select * from public.audit_log")).rowCount).toBe(0);
      await erwarteFehler(q("select * from public.email_outbox"), "42501");
      await erwarteFehler(q("select * from public.bericht_versand"), "42501");
    });
  });

  it("sieht nur sich selbst und die eigenen Berater als Profile", async () => {
    await db.als(f.kundeA, async (q) => {
      const ids = (await q("select id from public.profiles")).rows.map((r) => r.id).sort();
      expect(ids).toEqual([f.kundeA, f.beraterA].sort());
    });
  });
});

describe("Berater ohne Zuordnung", () => {
  it("sieht keinen einzigen Kunden und keine Kunden-Logins", async () => {
    await db.als(f.beraterOhne, async (q) => {
      expect((await q("select * from public.customers")).rowCount).toBe(0);
      expect((await q("select * from public.stories")).rowCount).toBe(0);
      expect((await q("select * from public.time_entries")).rowCount).toBe(0);
      expect((await q("select * from storage.objects")).rowCount).toBe(0);
      expect((await q("select * from public.profiles where rolle = 'kunde'")).rowCount).toBe(0);
    });
  });
});

describe("Anonyme und deaktivierte Nutzer", () => {
  it("anon hat keinerlei Zugriff", async () => {
    for (const tabelle of [
      "profiles", "customers", "kontingente", "stories", "tickets", "time_entries", "comments",
      "approvals", "meetings", "monatsabschluesse", "audit_log", "notifications", "email_outbox",
      "kontingent_stand", "kunden_kennzahlen",
    ]) {
      await db.als(null, async (q) => {
        await erwarteFehler(q(`select * from public.${tabelle}`), "42501");
      });
    }
    await db.als(null, async (q) => {
      expect((await q("select * from storage.objects")).rowCount).toBe(0);
      await erwarteFehler(q("select public.story_transition($1, 'abgenommen')", [f.A.story]), "42501");
    });
  });

  it("deaktivierter Login sieht nichts mehr – auch nicht den früheren eigenen Kunden", async () => {
    // Kunde A wird deaktiviert
    await db.q("update public.profiles set aktiv = false where id = $1", [f.kundeA]);
    try {
      await db.als(f.kundeA, async (q) => {
        for (const [tabelle, sql, params] of leseAbfragen(f.A)) {
          expect((await q(sql, params)).rowCount, `deaktiviert: ${tabelle}`).toBe(0);
        }
        await erwarteFehler(q("insert into public.tickets (customer_id, titel) values ($1, 'x')", [f.A.customer]));
      });
    } finally {
      await db.q("update public.profiles set aktiv = true where id = $1", [f.kundeA]);
    }
  });

  it("Nutzer ohne Profil sieht nichts", async () => {
    await db.als("99999999-9999-4999-a999-999999999999", async (q) => {
      expect((await q("select * from public.customers")).rowCount).toBe(0);
      expect((await q("select * from public.profiles")).rowCount).toBe(0);
    });
  });
});
