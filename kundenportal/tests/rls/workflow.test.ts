/**
 * Fachliche Abläufe: Story-Workflow, Tickets, Kontingentwarnungen,
 * Monatsabschluss, Ansprechpartnerwechsel, Benachrichtigungen.
 */
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { TestDb, erwarteFehler } from "./db";
import { fixturesAnlegen, type Fixtures } from "./fixtures";

const db = new TestDb();
let f: Fixtures;

beforeAll(async () => {
  await db.start();
  f = await fixturesAnlegen(db.q);
});
afterAll(() => db.stop());

const status = async (storyId: string) =>
  (await db.q("select status from public.stories where id = $1", [storyId])).rows[0].status as string;

const neueStory = async () =>
  (await db.q("insert into public.stories (customer_id, titel, erstellt_von) values ($1, 'Workflow', $2) returning id",
    [f.A.customer, f.kundeA])).rows[0].id as string;

describe("Story-Workflow", () => {
  it("durchläuft alle Status mit den richtigen Rollen und protokolliert jeden Schritt", async () => {
    const id = await neueStory();
    const schritt = (nutzer: string, nach: string, kommentar?: string, schaetzung?: number) =>
      db.alsBleibend(nutzer, (q) =>
        q("select public.story_transition($1, $2, $3, $4)", [id, nach, kommentar ?? null, schaetzung ?? null]));

    await schritt(f.kundeA, "zur_schaetzung_freigegeben");
    await schritt(f.beraterA, "geschaetzt", undefined, 4.5);
    expect((await db.q("select schaetzung_stunden from public.stories where id = $1", [id])).rows[0].schaetzung_stunden).toBe("4.50");
    await schritt(f.kundeA, "entwurf", "Zu teuer");
    await schritt(f.kundeA, "zur_schaetzung_freigegeben");
    await schritt(f.beraterA, "geschaetzt", undefined, 3);
    await schritt(f.kundeA, "zur_umsetzung_freigegeben");
    await schritt(f.beraterA, "in_umsetzung");
    await schritt(f.beraterA, "zur_abnahme");
    await schritt(f.kundeA, "in_umsetzung", "Fehler in Feld X");
    await schritt(f.beraterA, "zur_abnahme");
    await schritt(f.kundeA, "abgenommen");
    expect(await status(id)).toBe("abgenommen");

    const verlauf = await db.q(
      "select aktion, von_status, nach_status, user_id, kommentar from public.approvals where story_id = $1 order by created_at, id",
      [id]);
    expect(verlauf.rowCount).toBe(11);
    const aktionen = verlauf.rows.map((r) => r.aktion);
    expect(aktionen).toContain("schaetzung_abgelehnt");
    expect(aktionen).toContain("abnahme_abgelehnt");
    expect(verlauf.rows.find((r) => r.aktion === "schaetzung_abgelehnt")).toMatchObject({
      von_status: "geschaetzt", nach_status: "entwurf", user_id: f.kundeA, kommentar: "Zu teuer",
    });
  });

  it("lehnt Übergänge der falschen Rolle ab", async () => {
    const id = await neueStory();
    // Berater darf nicht für den Kunden freigeben
    await db.als(f.beraterA, (q) => erwarteFehler(q("select public.story_transition($1, 'zur_schaetzung_freigegeben')", [id]), "42501"));
    await db.alsBleibend(f.kundeA, (q) => q("select public.story_transition($1, 'zur_schaetzung_freigegeben')", [id]));
    // Kunde darf nicht schätzen
    await db.als(f.kundeA, (q) => erwarteFehler(q("select public.story_transition($1, 'geschaetzt', null, 5)", [id]), "42501"));
    await db.alsBleibend(f.beraterA, (q) => q("select public.story_transition($1, 'geschaetzt', null, 5)", [id]));
    // Berater darf die Schätzung nicht selbst freigeben oder ablehnen
    await db.als(f.beraterA, (q) => erwarteFehler(q("select public.story_transition($1, 'zur_umsetzung_freigegeben')", [id]), "42501"));
    await db.als(f.beraterA, (q) => erwarteFehler(q("select public.story_transition($1, 'entwurf', 'x')", [id]), "42501"));
    // Customer Success darf gar nichts
    await db.als(f.cs, (q) => erwarteFehler(q("select public.story_transition($1, 'zur_umsetzung_freigegeben')", [id]), "42501"));
    expect(await status(id)).toBe("geschaetzt");
  });

  it("lehnt nicht definierte Übergänge ab (Status überspringen)", async () => {
    const id = await neueStory();
    await db.als(f.kundeA, (q) => erwarteFehler(q("select public.story_transition($1, 'abgenommen')", [id]), "42501"));
    await db.als(f.admin, (q) => erwarteFehler(q("select public.story_transition($1, 'in_umsetzung')", [id]), "42501"));
  });

  it("erzwingt Kommentar bei Ablehnung und Schätzung beim Schätzen", async () => {
    const id = await neueStory();
    await db.alsBleibend(f.kundeA, (q) => q("select public.story_transition($1, 'zur_schaetzung_freigegeben')", [id]));
    await db.als(f.beraterA, (q) => erwarteFehler(q("select public.story_transition($1, 'geschaetzt')", [id]), "23514"));
    await db.als(f.beraterA, (q) => erwarteFehler(q("select public.story_transition($1, 'geschaetzt', null, 0)", [id]), "23514"));
    await db.alsBleibend(f.beraterA, (q) => q("select public.story_transition($1, 'geschaetzt', null, 2)", [id]));
    await db.als(f.kundeA, (q) => erwarteFehler(q("select public.story_transition($1, 'entwurf', '   ')", [id]), "23514"));
    await db.als(f.kundeA, (q) => erwarteFehler(q("select public.story_transition($1, 'entwurf')", [id]), "23514"));
  });

  it("benachrichtigt die jeweils andere Seite per In-App und E-Mail", async () => {
    const id = await neueStory();
    await db.q("delete from public.notifications; delete from public.email_outbox;");
    await db.alsBleibend(f.kundeA, (q) => q("select public.story_transition($1, 'zur_schaetzung_freigegeben')", [id]));
    let n = await db.q("select user_id, typ from public.notifications");
    expect(n.rows).toEqual([{ user_id: f.beraterA, typ: "story_zur_schaetzung" }]);
    expect((await db.q("select user_id, link from public.email_outbox")).rows).toEqual([
      { user_id: f.beraterA, link: `/k/${f.A.customer}/stories/${id}` },
    ]);

    await db.q("delete from public.notifications; delete from public.email_outbox;");
    await db.alsBleibend(f.beraterA, (q) => q("select public.story_transition($1, 'geschaetzt', null, 1)", [id]));
    n = await db.q("select user_id, typ from public.notifications");
    expect(n.rows).toEqual([{ user_id: f.kundeA, typ: "story_geschaetzt" }]);
    expect((await db.q("select count(*)::int as n from public.email_outbox where user_id = $1", [f.kundeA])).rows[0].n).toBe(1);
  });
});

describe("Tickets", () => {
  it("Antwort des Kunden auf wartendes Ticket setzt es zurück auf in_arbeit", async () => {
    expect((await db.q("select status from public.tickets where id = $1", [f.A.ticket])).rows[0].status).toBe("wartet_auf_kunde");
    await db.alsBleibend(f.kundeA, (q) =>
      q("insert into public.comments (customer_id, ticket_id, text) values ($1, $2, 'Hier die Antwort')", [f.A.customer, f.A.ticket]));
    expect((await db.q("select status from public.tickets where id = $1", [f.A.ticket])).rows[0].status).toBe("in_arbeit");
    const n = await db.q("select typ from public.notifications where user_id = $1", [f.beraterA]);
    expect(n.rows.map((r) => r.typ)).toContain("kommentar_kunde");
  });

  it("Kunde kann Tickets anlegen, aber nicht deren Status ändern", async () => {
    await db.als(f.kundeA, async (q) => {
      const t = await q("insert into public.tickets (customer_id, titel, status) values ($1, 'Neu', 'erledigt') returning status, erstellt_von", [f.A.customer]);
      expect(t.rows[0]).toEqual({ status: "neu", erstellt_von: f.kundeA });
      expect((await q("update public.tickets set status = 'erledigt' where id = $1", [f.A.ticket])).rowCount).toBe(0);
    });
  });

  it("Berater wandelt ein Ticket in eine Story um (gegenseitig verknüpft, Ticket erledigt)", async () => {
    const ticket = (await db.q("insert into public.tickets (customer_id, titel, beschreibung, erstellt_von) values ($1, 'Wunsch', 'Details', $2) returning id",
      [f.A.customer, f.kundeA])).rows[0].id;
    await db.als(f.kundeA, (q) => erwarteFehler(q("select public.ticket_in_story_umwandeln($1)", [ticket]), "42501"));
    const storyId = await db.alsBleibend(f.beraterA, async (q) =>
      (await q("select public.ticket_in_story_umwandeln($1) as id", [ticket])).rows[0].id);
    const story = (await db.q("select * from public.stories where id = $1", [storyId])).rows[0];
    expect(story).toMatchObject({ titel: "Wunsch", beschreibung: "Details", status: "entwurf", ticket_id: ticket, customer_id: f.A.customer });
    const t = (await db.q("select status, story_id from public.tickets where id = $1", [ticket])).rows[0];
    expect(t).toEqual({ status: "erledigt", story_id: storyId });
    await db.als(f.beraterA, (q) => erwarteFehler(q("select public.ticket_in_story_umwandeln($1)", [ticket]), "23514"));
  });
});

describe("Kontingentwarnungen", () => {
  it("meldet 80 % und 100 % je einmal und setzt bei neuem Kontingent zurück", async () => {
    const c = f.B.customer; // 100 h Kontingent, 1,5 h verbraucht
    const warnungen = async () =>
      (await db.q("select schwelle from public.kontingent_warnungen where customer_id = $1 order by schwelle", [c])).rows.map((r) => r.schwelle);
    const meldungen = async () =>
      (await db.q("select count(*)::int as n from public.email_outbox where user_id = $1 and typ like 'kontingent_%'", [f.kundeB])).rows[0].n;
    const zeit = (h: number) => db.alsBleibend(f.beraterB, (q) =>
      q("insert into public.time_entries (customer_id, datum, dauer_stunden, kategorie) values ($1, current_date, $2, 'entwicklung')", [c, h]));

    await zeit(20); await zeit(20); await zeit(20); await zeit(10); // 71,5 h
    expect(await warnungen()).toEqual([]);
    await zeit(10); // 81,5 h
    expect(await warnungen()).toEqual([80]);
    expect(await meldungen()).toBe(1);
    await zeit(1); // weiterhin über 80 % => keine neue Meldung
    expect(await meldungen()).toBe(1);
    await zeit(20); // 102,5 h
    expect(await warnungen()).toEqual([80, 100]);
    expect(await meldungen()).toBe(2);
    // Hauptberater erhält die Meldung ebenfalls, obwohl er selbst gebucht hat
    expect((await db.q("select count(*)::int as n from public.notifications where user_id = $1 and typ = 'kontingent_100'", [f.beraterB])).rows[0].n).toBe(1);
    // Rest darf negativ werden
    expect(Number((await db.q("select rest from public.kontingent_stand where customer_id = $1", [c])).rows[0].rest)).toBeLessThan(0);

    // Neues Kontingent: 102,5 / 200 h => beide Schwellen zurückgesetzt
    await db.alsBleibend(f.beraterB, (q) => q("insert into public.kontingente (customer_id, leistung, stunden) values ($1, 'Nachkauf', 100)", [c]));
    expect(await warnungen()).toEqual([]);
    await zeit(20); await zeit(20); await zeit(20); // 162,5 / 200 => 80 % erneut gemeldet
    expect(await warnungen()).toEqual([80]);
    expect(await meldungen()).toBe(3);
  });

  it("nicht abrechenbare Zeiten zählen nicht zum Verbrauch", async () => {
    const vorher = (await db.q("select verbraucht from public.kontingent_stand where customer_id = $1", [f.A.customer])).rows[0].verbraucht;
    await db.alsBleibend(f.beraterA, (q) => q(
      "insert into public.time_entries (customer_id, datum, dauer_stunden, kategorie, abrechenbar) values ($1, current_date, 5, 'beratung', false)",
      [f.A.customer]));
    const nachher = (await db.q("select verbraucht from public.kontingent_stand where customer_id = $1", [f.A.customer])).rows[0].verbraucht;
    expect(nachher).toBe(vorher);
  });
});

describe("Monatsabschluss", () => {
  it("Berater schließt ab, nur admin öffnet wieder (mit Audit-Log)", async () => {
    const monat = "2022-05";
    const zeit = await db.alsBleibend(f.beraterA, async (q) =>
      (await q("insert into public.time_entries (customer_id, datum, dauer_stunden, kategorie) values ($1, '2022-05-10', 1, 'beratung') returning id",
        [f.A.customer])).rows[0].id);

    await db.als(f.kundeA, (q) => erwarteFehler(q("select public.monat_abschliessen($1, $2)", [f.A.customer, monat]), "42501"));
    await db.alsBleibend(f.beraterA, (q) => q("select public.monat_abschliessen($1, $2)", [f.A.customer, monat]));
    await db.als(f.beraterA, (q) => erwarteFehler(q("select public.monat_abschliessen($1, $2)", [f.A.customer, monat]), "23514"));
    await db.als(f.beraterA, (q) => erwarteFehler(q("update public.time_entries set dauer_stunden = 2 where id = $1", [zeit]), "42501"));

    await db.als(f.beraterA, (q) => erwarteFehler(q("select public.monat_wiedereroeffnen($1, $2, 'Korrektur')", [f.A.customer, monat]), "42501"));
    await db.als(f.admin, (q) => erwarteFehler(q("select public.monat_wiedereroeffnen($1, $2, '')", [f.A.customer, monat]), "23514"));
    await db.alsBleibend(f.admin, (q) => q("select public.monat_wiedereroeffnen($1, $2, 'Korrektur Rechnung')", [f.A.customer, monat]));

    const audit = await db.q("select user_id, details from public.audit_log where aktion = 'monat_wiedereroeffnet' order by created_at desc limit 1");
    expect(audit.rows[0]).toMatchObject({ user_id: f.admin, details: { monat, grund: "Korrektur Rechnung" } });
    await db.als(f.beraterA, async (q) => {
      expect((await q("update public.time_entries set dauer_stunden = 2 where id = $1", [zeit])).rowCount).toBe(1);
    });
  });

  it("zukünftige Monate können nicht abgeschlossen werden", async () => {
    await db.als(f.beraterA, (q) => erwarteFehler(q("select public.monat_abschliessen($1, '2999-01')", [f.A.customer]), "22023"));
  });
});

describe("Ansprechpartner wechseln", () => {
  it("nur admin; alter Login wird deaktiviert und verliert den Zugriff", async () => {
    const neu = f.kundeInaktiv;
    await db.q("update public.profiles set aktiv = true where id = $1", [neu]);
    await db.als(f.beraterA, (q) => erwarteFehler(q("select public.kunde_login_wechseln($1, $2)", [f.A.customer, neu]), "42501"));
    // Login eines anderen Kunden kann nicht übernommen werden
    await db.als(f.admin, (q) => erwarteFehler(q("select public.kunde_login_wechseln($1, $2)", [f.A.customer, f.kundeB]), "23514"));

    await db.alsBleibend(f.admin, (q) => q("select public.kunde_login_wechseln($1, $2)", [f.A.customer, neu]));
    expect((await db.q("select aktiv from public.profiles where id = $1", [f.kundeA])).rows[0].aktiv).toBe(false);
    await db.als(f.kundeA, async (q) => {
      expect((await q("select * from public.stories")).rowCount).toBe(0);
    });
    await db.als(neu, async (q) => {
      expect((await q("select * from public.stories where customer_id = $1", [f.A.customer])).rowCount).toBeGreaterThan(0);
    });
    const audit = await db.q("select details from public.audit_log where aktion = 'ansprechpartner_gewechselt'");
    expect(audit.rows[0].details).toEqual({ alter_login: f.kundeA, neuer_login: neu });
  });
});
