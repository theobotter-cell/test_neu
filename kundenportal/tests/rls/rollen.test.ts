/**
 * Rollenrechte innerhalb des eigenen Kunden: Kunde und Customer Success nur
 * lesend bei Zeiten, Status nur über story_transition(), Protokolle nur INSERT.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, erwarteFehler, erwarteKeineWirkung } from "./db";
import { fixturesAnlegen, type Fixtures } from "./fixtures";

const db = new TestDb();
let f: Fixtures;

beforeAll(async () => {
  await db.start();
  f = await fixturesAnlegen(db.q);
});
afterAll(() => db.stop());

describe("Zeiterfassung", () => {
  it("Kunde darf eigene Zeiten nur lesen", async () => {
    await db.als(f.kundeA, async (q) => {
      expect((await q("select * from public.time_entries where id = $1", [f.A.zeit])).rowCount).toBe(1);
      await erwarteFehler(q(
        "insert into public.time_entries (customer_id, datum, dauer_stunden, kategorie) values ($1, current_date, 1, 'beratung')",
        [f.A.customer]));
      await erwarteKeineWirkung(q("update public.time_entries set dauer_stunden = 0.25 where id = $1", [f.A.zeit]));
      await erwarteKeineWirkung(q("delete from public.time_entries where id = $1", [f.A.zeit]));
    });
  });

  it("Berater des Kunden erfasst, ändert und löscht Zeiten", async () => {
    await db.als(f.beraterA, async (q) => {
      const neu = await q(
        "insert into public.time_entries (customer_id, datum, dauer_stunden, kategorie, beschreibung) values ($1, current_date, 1, 'entwicklung', 'x') returning erfasst_von",
        [f.A.customer]);
      expect(neu.rows[0].erfasst_von).toBe(f.beraterA);
      expect((await q("update public.time_entries set dauer_stunden = 2 where id = $1", [f.A.zeit])).rowCount).toBe(1);
      expect((await q("delete from public.time_entries where id = $1", [f.A.zeit])).rowCount).toBe(1);
    });
  });

  it("Berater kann Zeiten nicht im Namen anderer erfassen", async () => {
    await db.als(f.beraterA, async (q) => {
      await erwarteFehler(q(
        "insert into public.time_entries (customer_id, erfasst_von, datum, dauer_stunden, kategorie) values ($1, $2, current_date, 1, 'beratung')",
        [f.A.customer, f.admin]));
    });
  });

  it("Zeiten in abgeschlossenen Monaten sind für alle gesperrt (auch admin)", async () => {
    for (const nutzer of [f.beraterA, f.admin]) {
      await db.als(nutzer, async (q) => {
        await erwarteFehler(q("update public.time_entries set dauer_stunden = 1 where id = $1", [f.zeitGesperrt]), "42501");
        await erwarteFehler(q("delete from public.time_entries where id = $1", [f.zeitGesperrt]), "42501");
        await erwarteFehler(q(
          "insert into public.time_entries (customer_id, datum, dauer_stunden, kategorie) values ($1, $2, 1, 'beratung')",
          [f.A.customer, f.gesperrtesDatum]), "42501");
        // Verschieben einer offenen Zeit in den gesperrten Monat
        await erwarteFehler(q("update public.time_entries set datum = $2 where id = $1", [f.A.zeit, f.gesperrtesDatum]), "42501");
      });
    }
  });
});

describe("Customer Success", () => {
  it("liest alle Kunden", async () => {
    await db.als(f.cs, async (q) => {
      const r = await q("select id from public.customers where id in ($1, $2)", [f.A.customer, f.B.customer]);
      expect(r.rowCount).toBe(2);
      expect((await q("select * from public.kunden_kennzahlen where customer_id in ($1, $2)", [f.A.customer, f.B.customer])).rowCount).toBe(2);
      expect((await q("select * from storage.objects where name = $1", [f.B.datei])).rowCount).toBe(1);
    });
  });

  it("kann nichts schreiben", async () => {
    const versuche: [string, unknown[]][] = [
      ["insert into public.stories (customer_id, titel) values ($1, 'x')", [f.A.customer]],
      ["insert into public.tickets (customer_id, titel) values ($1, 'x')", [f.A.customer]],
      ["insert into public.comments (customer_id, story_id, text) values ($1, $2, 'x')", [f.A.customer, f.A.story]],
      ["insert into public.time_entries (customer_id, datum, dauer_stunden, kategorie) values ($1, current_date, 1, 'beratung')", [f.A.customer]],
      ["insert into public.kontingente (customer_id, leistung, stunden) values ($1, 'x', 1)", [f.A.customer]],
      ["insert into public.meetings (customer_id, datum, titel) values ($1, current_date, 'x')", [f.A.customer]],
      ["insert into storage.objects (bucket_id, name) values ('transkripte', $1)", [`${f.A.customer}/${f.A.meeting}/x.txt`]],
      ["select public.story_transition($1, 'zur_umsetzung_freigegeben')", [f.A.story]],
      ["select public.monat_abschliessen($1, '2020-02')", [f.A.customer]],
    ];
    for (const [sql, params] of versuche) {
      await db.als(f.cs, (q) => erwarteFehler(q(sql, params)));
    }
    for (const sql of [
      "update public.stories set titel = 'x'",
      "update public.tickets set titel = 'x'",
      "update public.time_entries set dauer_stunden = 1",
      "update public.kontingente set stunden = 1",
      "update public.meetings set titel = 'x'",
      "delete from public.stories",
      "delete from public.time_entries",
      "delete from public.comments",
      "delete from storage.objects",
    ]) {
      await db.als(f.cs, (q) => erwarteKeineWirkung(q(sql)));
    }
  });

  it("sieht keine Monatsabschlüsse (rein intern für Berater/admin)", async () => {
    await db.als(f.cs, async (q) => {
      expect((await q("select * from public.monatsabschluesse")).rowCount).toBe(0);
    });
  });
});

describe("Story-Status nur über story_transition()", () => {
  it("direktes UPDATE der Spalte status ist für alle Rollen gesperrt", async () => {
    for (const nutzer of [f.kundeA, f.beraterA, f.admin]) {
      await db.als(nutzer, async (q) => {
        await erwarteFehler(q("update public.stories set status = 'abgenommen' where id = $1", [f.A.story]), "42501");
        await erwarteFehler(q("update public.stories set schaetzung_stunden = 1 where id = $1", [f.A.story]), "42501");
      });
    }
  });

  it("Story wird immer als Entwurf angelegt", async () => {
    await db.als(f.kundeA, async (q) => {
      // Mitgeschickter Status / Ersteller / Schätzung werden serverseitig überschrieben
      const r = await q(
        "insert into public.stories (customer_id, titel, status, erstellt_von, schaetzung_stunden) values ($1, 'x', 'abgenommen', $2, 99) returning status, erstellt_von, schaetzung_stunden",
        [f.A.customer, f.beraterA]);
      expect(r.rows[0]).toEqual({ status: "entwurf", erstellt_von: f.kundeA, schaetzung_stunden: null });
    });
  });

  it("Kunde kann Stories außerhalb des Entwurfs nicht bearbeiten", async () => {
    await db.als(f.kundeA, async (q) => {
      await erwarteKeineWirkung(q("update public.stories set titel = 'x' where id = $1", [f.A.story]));
      expect((await q("update public.stories set titel = 'neu' where id = $1", [f.A.storyEntwurf])).rowCount).toBe(1);
    });
  });
});

describe("Unveränderliche Protokolle", () => {
  it("approvals: kein INSERT/UPDATE/DELETE für Clients, kein UPDATE/DELETE für niemanden", async () => {
    for (const nutzer of [f.kundeA, f.beraterA, f.admin]) {
      await db.als(nutzer, async (q) => {
        await erwarteFehler(q(
          "insert into public.approvals (customer_id, story_id, aktion, nach_status) values ($1, $2, 'x', 'abgenommen')",
          [f.A.customer, f.A.story]), "42501");
        await erwarteFehler(q("update public.approvals set kommentar = 'x' where id = $1", [f.A.approval]), "42501");
        await erwarteFehler(q("delete from public.approvals where id = $1", [f.A.approval]), "42501");
      });
    }
    // Selbst der Datenbank-Eigentümer kann das Protokoll nicht ändern
    await erwarteFehler(db.q("update public.approvals set kommentar = 'x' where id = $1", [f.A.approval]), "42501");
    await erwarteFehler(db.q("delete from public.approvals where id = $1", [f.A.approval]), "42501");
  });

  it("audit_log: nur admin liest, niemand ändert", async () => {
    await db.q("insert into public.audit_log (aktion, objekt_typ) values ('test', 'test')");
    await db.als(f.beraterA, async (q) => {
      expect((await q("select * from public.audit_log")).rowCount).toBe(0);
    });
    await db.als(f.admin, async (q) => {
      expect((await q("select * from public.audit_log")).rowCount).toBeGreaterThan(0);
      await erwarteFehler(q("insert into public.audit_log (aktion, objekt_typ) values ('x', 'x')"), "42501");
      await erwarteFehler(q("update public.audit_log set aktion = 'x'"), "42501");
      await erwarteFehler(q("delete from public.audit_log"), "42501");
    });
    await erwarteFehler(db.q("delete from public.audit_log"), "42501");
  });
});

describe("Profile und Rollen", () => {
  it("niemand außer admin kann die eigene Rolle ändern oder sich reaktivieren", async () => {
    for (const nutzer of [f.kundeA, f.beraterA, f.cs]) {
      await db.als(nutzer, async (q) => {
        await erwarteFehler(q("update public.profiles set rolle = 'admin' where id = auth.uid()"), "42501");
        await erwarteFehler(q("update public.profiles set email = 'x@y.z' where id = auth.uid()"), "42501");
      });
    }
    await db.als(f.kundeA, async (q) => {
      expect((await q("update public.profiles set name = 'Neuer Name' where id = auth.uid()")).rowCount).toBe(1);
      await erwarteFehler(q("insert into public.profiles (id, name, email, rolle) values (gen_random_uuid(), 'x', 'x@x', 'admin')"));
    });
  });

  it("admin ändert Rollen, Berater nicht fremde Profile", async () => {
    await db.als(f.beraterA, async (q) => {
      await erwarteKeineWirkung(q("update public.profiles set name = 'x' where id = $1", [f.kundeA]));
    });
    await db.als(f.admin, async (q) => {
      expect((await q("update public.profiles set aktiv = false where id = $1", [f.kundeB])).rowCount).toBe(1);
    });
  });

  it("Benachrichtigungen: nur eigene lesen und als gelesen markieren", async () => {
    await db.q("insert into public.notifications (user_id, typ, text) values ($1, 't', 'für A'), ($2, 't', 'für B')", [f.kundeA, f.kundeB]);
    await db.als(f.kundeA, async (q) => {
      const r = await q("select user_id from public.notifications");
      expect(r.rows.every((x) => x.user_id === f.kundeA)).toBe(true);
      expect((await q("update public.notifications set gelesen = true")).rowCount).toBe(1);
      await erwarteFehler(q("update public.notifications set text = 'x'"), "42501");
      await erwarteFehler(q("insert into public.notifications (user_id, typ, text) values (auth.uid(), 'x', 'x')"), "42501");
    });
  });

  it("interne Funktionen sind für Clients nicht aufrufbar", async () => {
    await db.als(f.kundeA, async (q) => {
      await erwarteFehler(q("select app.benachrichtigen(auth.uid(), 'x', 'x', null, true)"), "42501");
      await erwarteFehler(q("select app.audit('x', 'x', null, '{}')"), "42501");
      await erwarteFehler(q("select app.kontingent_pruefen($1)", [f.A.customer]), "42501");
    });
  });
});
