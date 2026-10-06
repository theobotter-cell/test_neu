-- =============================================================================
-- Linxys Kundenportal – Periodische Berichte
-- =============================================================================
-- Fertig gerenderte Bericht-E-Mails laufen über dieselbe Warteschlange.
alter table public.email_outbox add column html text;

-- Idempotenz: pro Kunde und Zeitraum wird ein Bericht genau einmal erzeugt,
-- auch wenn der Cron-Job mehrfach ausgelöst wird.
create table public.bericht_versand (
  customer_id uuid not null references public.customers (id) on delete cascade,
  von         date not null,
  bis         date not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  primary key (customer_id, von, bis)
);

create trigger set_updated_at before update on public.bericht_versand
  for each row execute function app.set_updated_at();

alter table public.bericht_versand enable row level security;
-- keine Policies: nur serverseitig (Service Role) zugänglich
revoke all on public.bericht_versand from anon, authenticated;
