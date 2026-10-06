-- =============================================================================
-- Linxys Kundenportal – Testdaten (nur für lokale Entwicklung / Staging!)
-- =============================================================================
-- Logins (Passwort für alle: Linxys2026!)
--   admin@linxys.test          admin
--   anna.berger@linxys.test    berater (Hauptberaterin Muster Handels GmbH)
--   tom.keller@linxys.test     berater (Hauptberater Beispiel Logistik AG)
--   cs@linxys.test             customer_success
--   kunde@muster-handel.test   kunde  (Muster Handels GmbH, > 80 % Verbrauch)
--   kunde@beispiel-logistik.test kunde (Beispiel Logistik AG)
-- =============================================================================

-- Feste IDs, damit Links reproduzierbar sind:
--   admin    00000000-0000-4000-a000-000000000001
--   anna     00000000-0000-4000-a000-000000000002
--   tom      00000000-0000-4000-a000-000000000003
--   cs       00000000-0000-4000-a000-000000000004
--   kundea   00000000-0000-4000-a000-000000000005
--   kundeb   00000000-0000-4000-a000-000000000006
--   firma_a  10000000-0000-4000-a000-000000000001
--   firma_b  10000000-0000-4000-a000-000000000002

-- -----------------------------------------------------------------------------
-- Auth-Nutzer
-- -----------------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
select
  '00000000-0000-0000-0000-000000000000', u.id::uuid, 'authenticated', 'authenticated', u.email,
  extensions.crypt('Linxys2026!', extensions.gen_salt('bf')), now(),
  '', '', '', '',
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('name', u.name), now(), now()
from (values
  ('00000000-0000-4000-a000-000000000001',  'admin@linxys.test',              'Lena Admin'),
  ('00000000-0000-4000-a000-000000000002',   'anna.berger@linxys.test',        'Anna Berger'),
  ('00000000-0000-4000-a000-000000000003',    'tom.keller@linxys.test',         'Tom Keller'),
  ('00000000-0000-4000-a000-000000000004',     'cs@linxys.test',                 'Clara Success'),
  ('00000000-0000-4000-a000-000000000005', 'kunde@muster-handel.test',       'Max Muster'),
  ('00000000-0000-4000-a000-000000000006', 'kunde@beispiel-logistik.test',   'Erika Beispiel')
) as u(id, email, name);

insert into auth.identities (id, provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id::text, u.id,
       jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users u
where u.email like '%.test';

-- -----------------------------------------------------------------------------
-- Profile
-- -----------------------------------------------------------------------------
insert into public.profiles (id, name, email, rolle, buchungslink) values
  ('00000000-0000-4000-a000-000000000001',  'Lena Admin',     'admin@linxys.test',            'admin',            null),
  ('00000000-0000-4000-a000-000000000002',   'Anna Berger',    'anna.berger@linxys.test',      'berater',          'https://calendly.com/linxys-anna-berger/30min'),
  ('00000000-0000-4000-a000-000000000003',    'Tom Keller',     'tom.keller@linxys.test',       'berater',          null),
  ('00000000-0000-4000-a000-000000000004',     'Clara Success',  'cs@linxys.test',               'customer_success', null),
  ('00000000-0000-4000-a000-000000000005', 'Max Muster',     'kunde@muster-handel.test',     'kunde',            null),
  ('00000000-0000-4000-a000-000000000006', 'Erika Beispiel', 'kunde@beispiel-logistik.test', 'kunde',            null);

-- -----------------------------------------------------------------------------
-- Kunden und Zuordnungen
-- -----------------------------------------------------------------------------
insert into public.customers (id, firmenname, kunde_user_id, hauptberater_id, bericht_intervall, bitrix_company_id) values
  ('10000000-0000-4000-a000-000000000001', 'Muster Handels GmbH',   '00000000-0000-4000-a000-000000000005', '00000000-0000-4000-a000-000000000002', 'monatlich',    '1042'),
  ('10000000-0000-4000-a000-000000000002', 'Beispiel Logistik AG',  '00000000-0000-4000-a000-000000000006', '00000000-0000-4000-a000-000000000003',  'woechentlich', null);

-- Tom unterstützt zusätzlich bei Muster Handels
insert into public.customer_consultants (customer_id, berater_id) values ('10000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000003');

-- -----------------------------------------------------------------------------
-- Kontingente
-- -----------------------------------------------------------------------------
insert into public.kontingente (customer_id, leistung, gebucht_am, stunden, betrag, bitrix_deal_id) values
  ('10000000-0000-4000-a000-000000000001', 'Supportpaket 20 h',        current_date - 120, 20, 2600.00, '5531'),
  ('10000000-0000-4000-a000-000000000001', 'Supportpaket 10 h',        current_date - 40,  10, 1350.00, null),
  ('10000000-0000-4000-a000-000000000002', 'Einführungspaket 40 h',    current_date - 110, 40, 5000.00, '5602');

-- -----------------------------------------------------------------------------
-- Tickets
-- -----------------------------------------------------------------------------
insert into public.tickets (id, customer_id, titel, beschreibung, typ, prioritaet, status, zustaendig_id, faellig_am, erstellt_von, created_at) values
  ('30000000-0000-4000-a000-000000000001', '10000000-0000-4000-a000-000000000001', 'Angebotsvorlage zeigt falsches Logo',
   'Seit dem Update erscheint im PDF-Angebot noch das alte Firmenlogo.', 'fehler', 'hoch', 'in_arbeit', '00000000-0000-4000-a000-000000000002', current_date + 3, '00000000-0000-4000-a000-000000000005', now() - interval '6 days'),
  ('30000000-0000-4000-a000-000000000002', '10000000-0000-4000-a000-000000000001', 'Wie exportiere ich Kontakte nach Excel?',
   'Wir möchten alle Kontakte mit Branche exportieren.', 'frage', 'normal', 'wartet_auf_kunde', '00000000-0000-4000-a000-000000000002', null, '00000000-0000-4000-a000-000000000005', now() - interval '12 days'),
  ('30000000-0000-4000-a000-000000000003', '10000000-0000-4000-a000-000000000001', 'Neues Feld "Kundennummer" im Deal',
   'Bitte ein Pflichtfeld für die Kundennummer anlegen.', 'aenderungswunsch', 'normal', 'neu', null, null, '00000000-0000-4000-a000-000000000005', now() - interval '1 day'),
  ('30000000-0000-4000-a000-000000000004', '10000000-0000-4000-a000-000000000001', 'Benutzer für neue Mitarbeiterin anlegen',
   'Frau Schulz startet am Monatsersten.', 'aufgabe', 'niedrig', 'erledigt', '00000000-0000-4000-a000-000000000003', null, '00000000-0000-4000-a000-000000000005', now() - interval '30 days'),
  ('30000000-0000-4000-a000-000000000005', '10000000-0000-4000-a000-000000000002', 'Lieferstatus wird nicht synchronisiert',
   'Die Lieferstatus aus dem ERP kommen nicht im CRM an.', 'fehler', 'kritisch', 'in_arbeit', '00000000-0000-4000-a000-000000000003', current_date + 1, '00000000-0000-4000-a000-000000000006', now() - interval '3 days'),
  ('30000000-0000-4000-a000-000000000006', '10000000-0000-4000-a000-000000000002', 'Schulung für Vertriebsteam',
   'Bitte Termin für eine 2-stündige Schulung vorschlagen.', 'aufgabe', 'normal', 'neu', null, null, '00000000-0000-4000-a000-000000000006', now() - interval '2 days');

-- Status-Zeitpunkt passend zum Anlagedatum
update public.tickets set status_seit = created_at + interval '1 day'
 where customer_id in ('10000000-0000-4000-a000-000000000001', '10000000-0000-4000-a000-000000000002') and status <> 'neu';

-- -----------------------------------------------------------------------------
-- Stories in allen Status (Muster Handels) + einige bei Beispiel Logistik
-- -----------------------------------------------------------------------------
insert into public.stories (id, customer_id, titel, beschreibung, akzeptanzkriterien, status, schaetzung_stunden, position, erstellt_von, ticket_id) values
  ('20000000-0000-4000-a000-000000000001', '10000000-0000-4000-a000-000000000001', 'Lead-Formular auf Website anbinden',
   'Website-Formular soll Leads direkt im CRM anlegen.', E'- Lead wird angelegt\n- Quelle = Website', 'entwurf', null, 0, '00000000-0000-4000-a000-000000000005', null),
  ('20000000-0000-4000-a000-000000000002', '10000000-0000-4000-a000-000000000001', 'Automatische Wiedervorlage für Angebote',
   'Nach 7 Tagen ohne Reaktion soll eine Aufgabe erzeugt werden.', E'- Aufgabe nach 7 Tagen\n- Verantwortlicher = Deal-Owner', 'zur_schaetzung_freigegeben', null, 0, '00000000-0000-4000-a000-000000000005', null),
  ('20000000-0000-4000-a000-000000000003', '10000000-0000-4000-a000-000000000001', 'Dashboard Vertriebskennzahlen',
   'Übersicht über Umsatz je Vertriebsmitarbeiter.', E'- Monatsumsatz\n- Abschlussquote', 'geschaetzt', 6, 0, '00000000-0000-4000-a000-000000000005', null),
  ('20000000-0000-4000-a000-000000000004', '10000000-0000-4000-a000-000000000001', 'Telefonie-Integration testen',
   'Placetel-Anbindung prüfen und dokumentieren.', '- Anrufe werden protokolliert', 'zur_umsetzung_freigegeben', 3, 0, '00000000-0000-4000-a000-000000000002', null),
  ('20000000-0000-4000-a000-000000000005', '10000000-0000-4000-a000-000000000001', 'Pipeline "Service" einrichten',
   'Eigene Pipeline für Serviceverträge.', E'- 5 Phasen\n- Pflichtfelder je Phase', 'in_umsetzung', 8, 0, '00000000-0000-4000-a000-000000000005', null),
  ('20000000-0000-4000-a000-000000000006', '10000000-0000-4000-a000-000000000001', 'E-Mail-Vorlagen überarbeiten',
   'Corporate Design in allen Vorlagen.', '- 6 Vorlagen angepasst', 'zur_abnahme', 4, 0, '00000000-0000-4000-a000-000000000005', null),
  ('20000000-0000-4000-a000-000000000007', '10000000-0000-4000-a000-000000000001', 'Dublettenprüfung Kontakte',
   'Dubletten anhand E-Mail und Telefonnummer erkennen.', E'- Regel aktiv\n- Bestand bereinigt', 'abgenommen', 5, 0, '00000000-0000-4000-a000-000000000005', null),
  ('20000000-0000-4000-a000-000000000008', '10000000-0000-4000-a000-000000000002', 'ERP-Schnittstelle Lieferstatus',
   'Lieferstatus aus dem ERP stündlich übernehmen.', '- Status im Deal sichtbar', 'in_umsetzung', 12, 0, '00000000-0000-4000-a000-000000000003', null),
  ('20000000-0000-4000-a000-000000000009', '10000000-0000-4000-a000-000000000002', 'Rechteprofil Lager',
   'Lagermitarbeiter sehen nur Lieferungen.', '- Kein Zugriff auf Deals', 'geschaetzt', 2.5, 0, '00000000-0000-4000-a000-000000000006', null);

-- Verlauf (approvals) passend zu den Status
insert into public.approvals (customer_id, story_id, aktion, von_status, nach_status, user_id, kommentar, created_at)
select s.customer_id, s.id, a.aktion, a.von::public.story_status, a.nach::public.story_status,
       case when a.wer = 'kunde' then c.kunde_user_id else c.hauptberater_id end,
       a.kommentar, now() - (a.tage_her || ' days')::interval
from public.stories s
join public.customers c on c.id = s.customer_id
join (values
  ('20000000-0000-4000-a000-000000000002', 'zur_schaetzung_freigegeben', 'entwurf', 'zur_schaetzung_freigegeben', 'kunde', null, 2),
  ('20000000-0000-4000-a000-000000000003', 'zur_schaetzung_freigegeben', 'entwurf', 'zur_schaetzung_freigegeben', 'kunde', null, 15),
  ('20000000-0000-4000-a000-000000000003', 'geschaetzt', 'zur_schaetzung_freigegeben', 'geschaetzt', 'berater', null, 10),
  ('20000000-0000-4000-a000-000000000004', 'zur_schaetzung_freigegeben', 'entwurf', 'zur_schaetzung_freigegeben', 'kunde', null, 20),
  ('20000000-0000-4000-a000-000000000004', 'geschaetzt', 'zur_schaetzung_freigegeben', 'geschaetzt', 'berater', null, 18),
  ('20000000-0000-4000-a000-000000000004', 'zur_umsetzung_freigegeben', 'geschaetzt', 'zur_umsetzung_freigegeben', 'kunde', null, 4),
  ('20000000-0000-4000-a000-000000000005', 'zur_schaetzung_freigegeben', 'entwurf', 'zur_schaetzung_freigegeben', 'kunde', null, 40),
  ('20000000-0000-4000-a000-000000000005', 'geschaetzt', 'zur_schaetzung_freigegeben', 'geschaetzt', 'berater', null, 38),
  ('20000000-0000-4000-a000-000000000005', 'schaetzung_abgelehnt', 'geschaetzt', 'entwurf', 'kunde', 'Bitte günstigere Variante ohne Automatisierung prüfen.', 35),
  ('20000000-0000-4000-a000-000000000005', 'zur_schaetzung_freigegeben', 'entwurf', 'zur_schaetzung_freigegeben', 'kunde', null, 34),
  ('20000000-0000-4000-a000-000000000005', 'geschaetzt', 'zur_schaetzung_freigegeben', 'geschaetzt', 'berater', null, 33),
  ('20000000-0000-4000-a000-000000000005', 'zur_umsetzung_freigegeben', 'geschaetzt', 'zur_umsetzung_freigegeben', 'kunde', null, 30),
  ('20000000-0000-4000-a000-000000000005', 'umsetzung_begonnen', 'zur_umsetzung_freigegeben', 'in_umsetzung', 'berater', null, 28),
  ('20000000-0000-4000-a000-000000000006', 'zur_schaetzung_freigegeben', 'entwurf', 'zur_schaetzung_freigegeben', 'kunde', null, 50),
  ('20000000-0000-4000-a000-000000000006', 'geschaetzt', 'zur_schaetzung_freigegeben', 'geschaetzt', 'berater', null, 48),
  ('20000000-0000-4000-a000-000000000006', 'zur_umsetzung_freigegeben', 'geschaetzt', 'zur_umsetzung_freigegeben', 'kunde', null, 45),
  ('20000000-0000-4000-a000-000000000006', 'umsetzung_begonnen', 'zur_umsetzung_freigegeben', 'in_umsetzung', 'berater', null, 44),
  ('20000000-0000-4000-a000-000000000006', 'zur_abnahme_gestellt', 'in_umsetzung', 'zur_abnahme', 'berater', null, 20),
  ('20000000-0000-4000-a000-000000000006', 'abnahme_abgelehnt', 'zur_abnahme', 'in_umsetzung', 'kunde', 'Die Signatur fehlt in zwei Vorlagen.', 15),
  ('20000000-0000-4000-a000-000000000006', 'zur_abnahme_gestellt', 'in_umsetzung', 'zur_abnahme', 'berater', null, 9),
  ('20000000-0000-4000-a000-000000000007', 'zur_schaetzung_freigegeben', 'entwurf', 'zur_schaetzung_freigegeben', 'kunde', null, 90),
  ('20000000-0000-4000-a000-000000000007', 'geschaetzt', 'zur_schaetzung_freigegeben', 'geschaetzt', 'berater', null, 88),
  ('20000000-0000-4000-a000-000000000007', 'zur_umsetzung_freigegeben', 'geschaetzt', 'zur_umsetzung_freigegeben', 'kunde', null, 85),
  ('20000000-0000-4000-a000-000000000007', 'umsetzung_begonnen', 'zur_umsetzung_freigegeben', 'in_umsetzung', 'berater', null, 80),
  ('20000000-0000-4000-a000-000000000007', 'zur_abnahme_gestellt', 'in_umsetzung', 'zur_abnahme', 'berater', null, 62),
  ('20000000-0000-4000-a000-000000000007', 'abgenommen', 'zur_abnahme', 'abgenommen', 'kunde', null, 60),
  ('20000000-0000-4000-a000-000000000008', 'umsetzung_begonnen', 'zur_umsetzung_freigegeben', 'in_umsetzung', 'berater', null, 25),
  ('20000000-0000-4000-a000-000000000009', 'zur_schaetzung_freigegeben', 'entwurf', 'zur_schaetzung_freigegeben', 'kunde', null, 6),
  ('20000000-0000-4000-a000-000000000009', 'geschaetzt', 'zur_schaetzung_freigegeben', 'geschaetzt', 'berater', null, 5)
) as a(story_id, aktion, von, nach, wer, kommentar, tage_her) on a.story_id::uuid = s.id;

-- Statuszeitpunkt = letzter Verlaufseintrag
update public.stories s
   set status_seit = coalesce((select max(a.created_at) from public.approvals a where a.story_id = s.id), s.created_at)
 where s.customer_id in ('10000000-0000-4000-a000-000000000001', '10000000-0000-4000-a000-000000000002')
   and s.status_seit is not null;

-- -----------------------------------------------------------------------------
-- Zeiten über die letzten vier Monate
-- -----------------------------------------------------------------------------
insert into public.time_entries (customer_id, erfasst_von, datum, dauer_stunden, beschreibung, kategorie, abrechenbar, story_id, ticket_id, bitrix_task_id)
values
  -- Muster Handels: zusammen 26 h abrechenbar bei 30 h Kontingent (≈ 87 %)
  ('10000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000002', current_date - 110, 1.0, 'Kick-off und Anforderungsaufnahme',         'beratung',    true,  null, null, null),
  ('10000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000002', current_date - 95,  1.5, 'Workshop Dublettenprüfung',                 'beratung',    true,  '20000000-0000-4000-a000-000000000007', null, null),
  ('10000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000002', current_date - 82,  3.0, 'Umsetzung Dublettenregel',                  'entwicklung', true,  '20000000-0000-4000-a000-000000000007', null, '88412'),
  ('10000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000003',  current_date - 75,  0.5, 'Benutzer angelegt',                         'beratung',    true,  null, '30000000-0000-4000-a000-000000000004', null),
  ('10000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000002', current_date - 70,  1.0, 'Interne Abstimmung (nicht abrechenbar)',    'beratung',    false, null, null, null),
  ('10000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000002', current_date - 62,  1.5, 'Vorlagen-Analyse',                          'beratung',    true,  '20000000-0000-4000-a000-000000000006', null, null),
  ('10000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000002', current_date - 55,  4.0, 'E-Mail-Vorlagen umgesetzt',                 'entwicklung', true,  '20000000-0000-4000-a000-000000000006', null, '88501'),
  ('10000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000002', current_date - 50,  8.0, 'Pipeline Service – Konfiguration',          'entwicklung', true,  null, null, '88533'),
  ('10000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000002', current_date - 50,  2.5, 'Pipeline Service – Pflichtfelder',          'entwicklung', true,  '20000000-0000-4000-a000-000000000005', null, '88534'),
  ('10000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000002', current_date - 35,  1.0, '',                                          'beratung',    true,  null, null, null),
  ('10000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000003',  current_date - 20,  1.5, 'Logo in Angebotsvorlage geprüft',           'beratung',    true,  null, '30000000-0000-4000-a000-000000000001', null),
  ('10000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000002', current_date - 9,   1.0, 'Korrektur Signaturen',                      'entwicklung', true,  '20000000-0000-4000-a000-000000000006', null, '88720'),
  ('10000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000002', current_date - 3,   0.5, 'Rückfrage Excel-Export beantwortet',        'beratung',    true,  null, '30000000-0000-4000-a000-000000000002', null),
  -- Beispiel Logistik: 15 h bei 40 h Kontingent
  ('10000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000003',  current_date - 100, 2.0, 'Kick-off',                                  'beratung',    true,  null, null, null),
  ('10000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000003',  current_date - 80,  3.0, 'Konzept ERP-Schnittstelle',                 'beratung',    true,  '20000000-0000-4000-a000-000000000008', null, null),
  ('10000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000003',  current_date - 60,  4.0, 'Schnittstelle Grundgerüst',                 'entwicklung', true,  '20000000-0000-4000-a000-000000000008', null, '90011'),
  ('10000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000003',  current_date - 25,  3.5, 'Mapping Lieferstatus',                      'entwicklung', true,  '20000000-0000-4000-a000-000000000008', null, '90057'),
  ('10000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000003',  current_date - 2,   2.5, 'Fehleranalyse Synchronisation',             'beratung',    true,  null, '30000000-0000-4000-a000-000000000005', null);

update public.time_entries set created_at = datum::timestamptz + interval '17 hours'
 where customer_id in ('10000000-0000-4000-a000-000000000001', '10000000-0000-4000-a000-000000000002');

-- -----------------------------------------------------------------------------
-- Kommentare
-- -----------------------------------------------------------------------------
insert into public.comments (customer_id, story_id, ticket_id, autor_id, text, created_at) values
  ('10000000-0000-4000-a000-000000000001', '20000000-0000-4000-a000-000000000006', null, '00000000-0000-4000-a000-000000000002',   'Die Vorlagen sind fertig – bitte einmal prüfen.', now() - interval '9 days'),
  ('10000000-0000-4000-a000-000000000001', '20000000-0000-4000-a000-000000000003', null, '00000000-0000-4000-a000-000000000005', 'Können wir die Abschlussquote auch je Quartal sehen?', now() - interval '8 days'),
  ('10000000-0000-4000-a000-000000000001', null, '30000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000002',   'Möchten Sie auch die Ansprechpartner exportieren?', now() - interval '11 days'),
  ('10000000-0000-4000-a000-000000000001', null, '30000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000005', 'Das alte Logo ist auch in der Rechnung zu sehen.', now() - interval '2 days'),
  ('10000000-0000-4000-a000-000000000002', null, '30000000-0000-4000-a000-000000000005', '00000000-0000-4000-a000-000000000003',    'Wir prüfen die Logs der Schnittstelle.', now() - interval '2 days');

-- -----------------------------------------------------------------------------
-- Termine mit Transkripten
-- -----------------------------------------------------------------------------
insert into public.meetings (customer_id, datum, titel, berater_id, transkript) values
  ('10000000-0000-4000-a000-000000000001', current_date - 110, 'Kick-off Bitrix24-Optimierung', '00000000-0000-4000-a000-000000000002',
   E'Teilnehmende: Max Muster, Anna Berger\n\nAnna: Willkommen zum Kick-off. Ziel ist die Optimierung des Vertriebsprozesses.\nMax: Uns ist vor allem die Dublettenprüfung wichtig.\nAnna: Das nehmen wir als erste Story auf.\n\nNächste Schritte: Story Dublettenprüfung anlegen, Workshop terminieren.'),
  ('10000000-0000-4000-a000-000000000001', current_date - 40,  'Review Service-Pipeline', '00000000-0000-4000-a000-000000000002',
   E'Teilnehmende: Max Muster, Anna Berger, Tom Keller\n\nDie neue Pipeline wurde vorgestellt. Phase "Vertrag aktiv" soll umbenannt werden.\nOffene Punkte: Pflichtfelder in Phase 3.'),
  ('10000000-0000-4000-a000-000000000002', current_date - 100, 'Kick-off ERP-Anbindung', '00000000-0000-4000-a000-000000000003',
   E'Teilnehmende: Erika Beispiel, Tom Keller\n\nZiel: Lieferstatus aus dem ERP im CRM anzeigen. Intervall stündlich.');

-- -----------------------------------------------------------------------------
-- Abgeschlossener Monat (Monat vor dem Vormonat) für Muster Handels
-- -----------------------------------------------------------------------------
insert into public.monatsabschluesse (customer_id, monat, status, abgeschlossen_von, abgeschlossen_am)
values ('10000000-0000-4000-a000-000000000001', to_char(current_date - interval '2 months', 'YYYY-MM'), 'abgeschlossen', '00000000-0000-4000-a000-000000000002', now() - interval '20 days');

-- Seed-Benachrichtigungen nicht per E-Mail versenden
update public.email_outbox set status = 'uebersprungen' where status = 'offen';

-- Historische Seed-Benachrichtigungen als gelesen markieren (Warnungen bleiben sichtbar)
update public.notifications set gelesen = true where typ not like 'kontingent_%';
