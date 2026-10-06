-- =============================================================================
-- Linxys Kundenportal – Datenmodell
-- =============================================================================
-- Alle kundenbezogenen Tabellen tragen customer_id. Alle Tabellen tragen
-- created_at / updated_at. Rechte (RLS) folgen in der nächsten Migration.
-- =============================================================================

-- Interne Hilfsfunktionen liegen im Schema "app", das NICHT über die
-- Supabase-API (PostgREST) exponiert wird.
create schema if not exists app;
revoke all on schema app from public;

-- -----------------------------------------------------------------------------
-- Aufzählungstypen
-- -----------------------------------------------------------------------------
create type public.rolle as enum ('admin', 'berater', 'customer_success', 'kunde');
create type public.bericht_intervall as enum ('woechentlich', 'monatlich', 'aus');
create type public.story_status as enum (
  'entwurf',
  'zur_schaetzung_freigegeben',
  'geschaetzt',
  'zur_umsetzung_freigegeben',
  'in_umsetzung',
  'zur_abnahme',
  'abgenommen'
);
create type public.ticket_typ as enum ('fehler', 'frage', 'aenderungswunsch', 'aufgabe');
create type public.ticket_prioritaet as enum ('niedrig', 'normal', 'hoch', 'kritisch');
create type public.ticket_status as enum ('neu', 'in_arbeit', 'wartet_auf_kunde', 'erledigt');
create type public.zeit_kategorie as enum ('beratung', 'entwicklung');
create type public.abschluss_status as enum ('offen', 'abgeschlossen');

-- -----------------------------------------------------------------------------
-- updated_at automatisch pflegen
-- -----------------------------------------------------------------------------
create or replace function app.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create table public.profiles (
  id           uuid primary key references auth.users (id) on delete cascade,
  name         text not null check (length(btrim(name)) > 0),
  email        text not null,
  rolle        public.rolle not null,
  buchungslink text check (buchungslink is null or buchungslink ~* '^https?://'),
  aktiv        boolean not null default true,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create unique index profiles_email_key on public.profiles (lower(email));

-- -----------------------------------------------------------------------------
-- customers
-- -----------------------------------------------------------------------------
create table public.customers (
  id                uuid primary key default gen_random_uuid(),
  firmenname        text not null check (length(btrim(firmenname)) > 0),
  kunde_user_id     uuid unique references public.profiles (id) on delete set null,
  hauptberater_id   uuid references public.profiles (id) on delete set null,
  bericht_intervall public.bericht_intervall not null default 'monatlich',
  bitrix_company_id text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index customers_hauptberater_idx on public.customers (hauptberater_id);

-- -----------------------------------------------------------------------------
-- customer_consultants (weitere zugeordnete Berater)
-- -----------------------------------------------------------------------------
create table public.customer_consultants (
  customer_id uuid not null references public.customers (id) on delete cascade,
  berater_id  uuid not null references public.profiles (id) on delete cascade,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (customer_id, berater_id)
);
create index customer_consultants_berater_idx on public.customer_consultants (berater_id);

-- -----------------------------------------------------------------------------
-- kontingente (gebuchte Leistungen; werden aufaddiert, verfallen nicht)
-- -----------------------------------------------------------------------------
create table public.kontingente (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid not null references public.customers (id) on delete cascade,
  leistung       text not null check (length(btrim(leistung)) > 0),
  gebucht_am     date not null default current_date,
  stunden        numeric(8, 2) not null check (stunden >= 0),
  betrag         numeric(12, 2) check (betrag is null or betrag >= 0),
  bitrix_deal_id text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index kontingente_customer_idx on public.kontingente (customer_id);

-- -----------------------------------------------------------------------------
-- kontingent_warnungen (je Schwelle höchstens eine Meldung)
-- -----------------------------------------------------------------------------
create table public.kontingent_warnungen (
  customer_id uuid not null references public.customers (id) on delete cascade,
  schwelle    integer not null check (schwelle in (80, 100)),
  gesendet_am timestamptz not null default now(),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (customer_id, schwelle)
);

-- -----------------------------------------------------------------------------
-- tickets & stories (gegenseitig verknüpfbar)
-- -----------------------------------------------------------------------------
create table public.stories (
  id                 uuid primary key default gen_random_uuid(),
  customer_id        uuid not null references public.customers (id) on delete cascade,
  titel              text not null check (length(btrim(titel)) > 0),
  beschreibung       text not null default '',
  akzeptanzkriterien text not null default '',
  status             public.story_status not null default 'entwurf',
  schaetzung_stunden numeric(8, 2) check (schaetzung_stunden is null or schaetzung_stunden >= 0),
  position           double precision not null default 0,
  erstellt_von       uuid references public.profiles (id) on delete set null,
  ticket_id          uuid,
  -- Zeitpunkt des letzten Statuswechsels (für "liegt seit X Tagen beim Kunden")
  status_seit        timestamptz not null default now(),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);
create index stories_customer_status_idx on public.stories (customer_id, status);

create table public.tickets (
  id           uuid primary key default gen_random_uuid(),
  customer_id  uuid not null references public.customers (id) on delete cascade,
  titel        text not null check (length(btrim(titel)) > 0),
  beschreibung text not null default '',
  typ          public.ticket_typ not null default 'frage',
  prioritaet   public.ticket_prioritaet not null default 'normal',
  status       public.ticket_status not null default 'neu',
  zustaendig_id uuid references public.profiles (id) on delete set null,
  faellig_am   date,
  erstellt_von uuid references public.profiles (id) on delete set null,
  story_id     uuid references public.stories (id) on delete set null,
  status_seit  timestamptz not null default now(),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index tickets_customer_status_idx on public.tickets (customer_id, status);

alter table public.stories
  add constraint stories_ticket_id_fkey
  foreign key (ticket_id) references public.tickets (id) on delete set null;

-- -----------------------------------------------------------------------------
-- time_entries
-- -----------------------------------------------------------------------------
create table public.time_entries (
  id             uuid primary key default gen_random_uuid(),
  customer_id    uuid not null references public.customers (id) on delete cascade,
  erfasst_von    uuid references public.profiles (id) on delete set null,
  datum          date not null,
  dauer_stunden  numeric(5, 2) not null check (dauer_stunden > 0 and dauer_stunden <= 24),
  beschreibung   text not null default '',
  kategorie      public.zeit_kategorie not null,
  abrechenbar    boolean not null default true,
  story_id       uuid references public.stories (id) on delete set null,
  ticket_id      uuid references public.tickets (id) on delete set null,
  bitrix_task_id text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);
create index time_entries_customer_datum_idx on public.time_entries (customer_id, datum);
create index time_entries_story_idx on public.time_entries (story_id);
create index time_entries_ticket_idx on public.time_entries (ticket_id);

-- -----------------------------------------------------------------------------
-- comments (genau eines von story_id / ticket_id)
-- -----------------------------------------------------------------------------
create table public.comments (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete cascade,
  story_id    uuid references public.stories (id) on delete cascade,
  ticket_id   uuid references public.tickets (id) on delete cascade,
  autor_id    uuid references public.profiles (id) on delete set null,
  -- Rolle des Autors zum Zeitpunkt des Kommentars (serverseitig gesetzt)
  autor_rolle public.rolle,
  text        text not null check (length(btrim(text)) > 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint comments_genau_ein_bezug check (num_nonnulls(story_id, ticket_id) = 1)
);
create index comments_story_idx on public.comments (story_id, created_at);
create index comments_ticket_idx on public.comments (ticket_id, created_at);
create index comments_customer_idx on public.comments (customer_id, created_at);

-- -----------------------------------------------------------------------------
-- approvals (unveränderliches Protokoll aller Story-Statuswechsel)
-- -----------------------------------------------------------------------------
create table public.approvals (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.customers (id) on delete restrict,
  story_id    uuid not null references public.stories (id) on delete restrict,
  aktion      text not null,
  von_status  public.story_status,
  nach_status public.story_status not null,
  user_id     uuid references public.profiles (id) on delete restrict,
  kommentar   text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index approvals_story_idx on public.approvals (story_id, created_at);
create index approvals_customer_idx on public.approvals (customer_id, created_at);

-- -----------------------------------------------------------------------------
-- meetings (Termine mit Transkript)
-- -----------------------------------------------------------------------------
create table public.meetings (
  id               uuid primary key default gen_random_uuid(),
  customer_id      uuid not null references public.customers (id) on delete cascade,
  datum            date not null,
  titel            text not null check (length(btrim(titel)) > 0),
  berater_id       uuid references public.profiles (id) on delete set null,
  transkript       text,
  transkript_datei text,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index meetings_customer_datum_idx on public.meetings (customer_id, datum desc);

-- -----------------------------------------------------------------------------
-- monatsabschluesse (rein intern)
-- -----------------------------------------------------------------------------
create table public.monatsabschluesse (
  id                uuid primary key default gen_random_uuid(),
  customer_id       uuid not null references public.customers (id) on delete cascade,
  monat             text not null check (monat ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  status            public.abschluss_status not null default 'offen',
  abgeschlossen_von uuid references public.profiles (id) on delete set null,
  abgeschlossen_am  timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (customer_id, monat)
);

-- -----------------------------------------------------------------------------
-- audit_log (nur INSERT)
-- -----------------------------------------------------------------------------
create table public.audit_log (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references public.profiles (id) on delete restrict,
  aktion     text not null,
  objekt_typ text not null,
  objekt_id  text,
  details    jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index audit_log_created_idx on public.audit_log (created_at desc);

-- -----------------------------------------------------------------------------
-- notifications (In-App)
-- -----------------------------------------------------------------------------
create table public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  typ        text not null,
  text       text not null,
  link       text,
  gelesen    boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index notifications_user_idx on public.notifications (user_id, gelesen, created_at desc);

-- -----------------------------------------------------------------------------
-- email_outbox (wird serverseitig befüllt und per Cron-Job versendet;
-- für Clients vollständig gesperrt)
-- -----------------------------------------------------------------------------
create table public.email_outbox (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid references public.profiles (id) on delete cascade,
  typ         text not null,
  betreff     text not null,
  text        text not null,
  link        text,
  status      text not null default 'offen'
              check (status in ('offen', 'gesendet', 'fehler', 'uebersprungen')),
  versuche    integer not null default 0,
  fehler      text,
  gesendet_am timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index email_outbox_offen_idx on public.email_outbox (created_at) where status = 'offen';

-- -----------------------------------------------------------------------------
-- updated_at-Trigger für alle Tabellen
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profiles', 'customers', 'customer_consultants', 'kontingente',
    'kontingent_warnungen', 'stories', 'tickets', 'time_entries', 'comments',
    'approvals', 'meetings', 'monatsabschluesse', 'audit_log', 'notifications',
    'email_outbox'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I
         for each row execute function app.set_updated_at()', t);
  end loop;
end;
$$;
