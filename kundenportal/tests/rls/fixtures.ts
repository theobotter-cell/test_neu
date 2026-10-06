/**
 * Testdaten für die RLS-Tests: zwei Kunden (A, B) mit vollständigen Daten in
 * allen kundenbezogenen Tabellen sowie Nutzer aller Rollen.
 */
import { randomUUID } from "node:crypto";
import type { Q } from "./db";

export type KundenDaten = {
  customer: string;
  kontingent: string;
  story: string;
  storyEntwurf: string;
  ticket: string;
  zeit: string;
  kommentarStory: string;
  kommentarTicket: string;
  meeting: string;
  datei: string;
  approval: string;
};

export type Fixtures = {
  admin: string;
  cs: string;
  beraterA: string;
  beraterB: string;
  beraterOhne: string;
  kundeA: string;
  kundeB: string;
  kundeInaktiv: string;
  A: KundenDaten;
  B: KundenDaten;
  /** Ein abgeschlossener Monat bei Kunde A (JJJJ-MM) und ein Datum darin */
  gesperrterMonat: string;
  gesperrtesDatum: string;
  zeitGesperrt: string;
};

async function nutzer(q: Q, rolle: string, name: string, aktiv = true) {
  const id = randomUUID();
  const email = `${name.toLowerCase().replace(/\W+/g, ".")}.${id.slice(0, 8)}@rls.test`;
  await q(
    `insert into auth.users (instance_id, id, aud, role, email, encrypted_password, created_at, updated_at,
       confirmation_token, recovery_token, email_change_token_new, email_change, raw_app_meta_data, raw_user_meta_data)
     values ('00000000-0000-0000-0000-000000000000', $1, 'authenticated', 'authenticated', $2, '', now(), now(),
       '', '', '', '', '{}'::jsonb, '{}'::jsonb)`,
    [id, email],
  );
  await q(`insert into public.profiles (id, name, email, rolle, aktiv) values ($1, $2, $3, $4, $5)`, [
    id, name, email, rolle, aktiv,
  ]);
  return id;
}

async function kunde(q: Q, name: string, kundeId: string, beraterId: string): Promise<KundenDaten> {
  const customer = randomUUID();
  await q(
    `insert into public.customers (id, firmenname, kunde_user_id, hauptberater_id) values ($1, $2, $3, $4)`,
    [customer, name, kundeId, beraterId],
  );
  const one = async (sql: string, params: unknown[]) => (await q(sql, params)).rows[0].id as string;

  const kontingent = await one(
    `insert into public.kontingente (customer_id, leistung, stunden) values ($1, 'Paket 100 h', 100) returning id`,
    [customer],
  );
  // Story im Status "geschaetzt" (Seed-Kontext: Status direkt setzbar, da auth.uid() leer)
  const story = await one(
    `insert into public.stories (customer_id, titel, status, schaetzung_stunden, erstellt_von)
     values ($1, 'Story ' || $2, 'geschaetzt', 5, $3) returning id`,
    [customer, name, kundeId],
  );
  const storyEntwurf = await one(
    `insert into public.stories (customer_id, titel, erstellt_von) values ($1, 'Entwurf ' || $2, $3) returning id`,
    [customer, name, kundeId],
  );
  const ticket = await one(
    `insert into public.tickets (customer_id, titel, erstellt_von, status) values ($1, 'Ticket ' || $2, $3, 'wartet_auf_kunde') returning id`,
    [customer, name, kundeId],
  );
  const zeit = await one(
    `insert into public.time_entries (customer_id, erfasst_von, datum, dauer_stunden, beschreibung, kategorie, story_id)
     values ($1, $2, current_date, 1.5, 'Arbeit', 'beratung', $3) returning id`,
    [customer, beraterId, story],
  );
  const kommentarStory = await one(
    `insert into public.comments (customer_id, story_id, autor_id, text) values ($1, $2, $3, 'Kommentar Story') returning id`,
    [customer, story, kundeId],
  );
  const kommentarTicket = await one(
    `insert into public.comments (customer_id, ticket_id, autor_id, text) values ($1, $2, $3, 'Kommentar Ticket') returning id`,
    [customer, ticket, beraterId],
  );
  const meeting = await one(
    `insert into public.meetings (customer_id, datum, titel, berater_id, transkript)
     values ($1, current_date, 'Termin', $2, 'Geheimes Transkript ' || $3) returning id`,
    [customer, beraterId, name],
  );
  const datei = `${customer}/${meeting}/transkript.txt`;
  await q(`insert into storage.objects (bucket_id, name, owner) values ('transkripte', $1, $2)`, [datei, beraterId]);
  await q(`update public.meetings set transkript_datei = $1 where id = $2`, [datei, meeting]);
  const approval = await one(
    `insert into public.approvals (customer_id, story_id, aktion, von_status, nach_status, user_id)
     values ($1, $2, 'geschaetzt', 'zur_schaetzung_freigegeben', 'geschaetzt', $3) returning id`,
    [customer, story, beraterId],
  );
  await q(
    `insert into public.monatsabschluesse (customer_id, monat, status) values ($1, '2020-01', 'offen')`,
    [customer],
  );
  return {
    customer, kontingent, story, storyEntwurf, ticket, zeit, kommentarStory, kommentarTicket, meeting, datei, approval,
  };
}

export async function fixturesAnlegen(q: Q): Promise<Fixtures> {
  const admin = await nutzer(q, "admin", "Admin");
  const cs = await nutzer(q, "customer_success", "CS");
  const beraterA = await nutzer(q, "berater", "Berater A");
  const beraterB = await nutzer(q, "berater", "Berater B");
  const beraterOhne = await nutzer(q, "berater", "Berater Ohne Zuordnung");
  const kundeA = await nutzer(q, "kunde", "Kunde A");
  const kundeB = await nutzer(q, "kunde", "Kunde B");
  const kundeInaktiv = await nutzer(q, "kunde", "Kunde Inaktiv", false);

  const A = await kunde(q, "A", kundeA, beraterA);
  const B = await kunde(q, "B", kundeB, beraterB);

  // Abgeschlossener Monat bei A mit einer Zeit darin
  const gesperrterMonat = "2021-03";
  const gesperrtesDatum = "2021-03-15";
  const zeitGesperrt = (
    await q(
      `insert into public.time_entries (customer_id, erfasst_von, datum, dauer_stunden, beschreibung, kategorie)
       values ($1, $2, $3, 2, 'Alt', 'entwicklung') returning id`,
      [A.customer, beraterA, gesperrtesDatum],
    )
  ).rows[0].id;
  await q(
    `insert into public.monatsabschluesse (customer_id, monat, status, abgeschlossen_am)
     values ($1, $2, 'abgeschlossen', now())`,
    [A.customer, gesperrterMonat],
  );

  // Benachrichtigungen der Fixture-Anlage verwerfen (Tests prüfen gezielt neue)
  await q(`delete from public.notifications where user_id in ($1, $2, $3, $4)`, [kundeA, kundeB, beraterA, beraterB]);
  await q(`delete from public.email_outbox where user_id in ($1, $2, $3, $4)`, [kundeA, kundeB, beraterA, beraterB]);

  return {
    admin, cs, beraterA, beraterB, beraterOhne, kundeA, kundeB, kundeInaktiv, A, B,
    gesperrterMonat, gesperrtesDatum, zeitGesperrt,
  };
}
