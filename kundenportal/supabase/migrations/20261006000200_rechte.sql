-- =============================================================================
-- Linxys Kundenportal – Rechte: Rollenprüfung, Schutz-Trigger, Row Level Security
-- =============================================================================
-- Grundsätze
--  * Die Rolle wird ausschließlich aus public.profiles gelesen (auth.uid()),
--    niemals aus Daten, die der Client mitschickt (z. B. user_metadata).
--  * Deaktivierte Profile (aktiv = false) haben keine Rolle und damit keinen
--    Zugriff.
--  * Alle Hilfsfunktionen sind SECURITY DEFINER mit leerem search_path und
--    liegen im nicht exponierten Schema "app".
-- =============================================================================

grant usage on schema app to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Rollen-Hilfsfunktionen
-- -----------------------------------------------------------------------------
create or replace function app.aktuelle_rolle()
returns public.rolle
language sql
stable
security definer
set search_path = ''
as $$
  select p.rolle
  from public.profiles p
  where p.id = auth.uid()
    and p.aktiv
$$;

create or replace function app.ist_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(app.aktuelle_rolle() = 'admin', false)
$$;

create or replace function app.ist_intern()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(app.aktuelle_rolle() in ('admin', 'berater', 'customer_success'), false)
$$;

-- Ist der aktuelle Nutzer ein dem Kunden zugeordneter Berater?
create or replace function app.ist_berater_von(p_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(app.aktuelle_rolle() = 'berater', false)
     and (
       exists (select 1 from public.customers c
               where c.id = p_customer_id and c.hauptberater_id = auth.uid())
       or exists (select 1 from public.customer_consultants cc
                  where cc.customer_id = p_customer_id and cc.berater_id = auth.uid())
     )
$$;

-- Ist der aktuelle Nutzer der Kunden-Login dieses Kunden?
create or replace function app.ist_kunde_von(p_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(app.aktuelle_rolle() = 'kunde', false)
     and exists (select 1 from public.customers c
                 where c.id = p_customer_id and c.kunde_user_id = auth.uid())
$$;

-- Lesen: admin, customer_success, zugeordnete Berater, eigener Kunde
create or replace function app.darf_lesen(p_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(app.aktuelle_rolle() in ('admin', 'customer_success'), false)
      or app.ist_berater_von(p_customer_id)
      or app.ist_kunde_von(p_customer_id)
$$;

-- Interne Bearbeitung: admin und zugeordnete Berater
create or replace function app.darf_bearbeiten(p_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.ist_admin() or app.ist_berater_von(p_customer_id)
$$;

-- Mitwirken (Stories/Tickets anlegen, kommentieren): Bearbeiter oder eigener Kunde
create or replace function app.darf_mitwirken(p_customer_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.darf_bearbeiten(p_customer_id) or app.ist_kunde_von(p_customer_id)
$$;

-- Darf ein Kunden-Login dieses Profil sehen? Nur sich selbst und interne
-- Personen, die mit dem eigenen Kunden tatsächlich in Berührung stehen.
create or replace function app.kunde_sieht_profil(p_profil_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.customers c
    join public.profiles p on p.id = p_profil_id and p.rolle <> 'kunde'
    where c.kunde_user_id = auth.uid()
      and (
        c.hauptberater_id = p_profil_id
        or exists (select 1 from public.customer_consultants cc
                   where cc.customer_id = c.id and cc.berater_id = p_profil_id)
        or exists (select 1 from public.comments x
                   where x.customer_id = c.id and x.autor_id = p_profil_id)
        or exists (select 1 from public.approvals x
                   where x.customer_id = c.id and x.user_id = p_profil_id)
        or exists (select 1 from public.time_entries x
                   where x.customer_id = c.id and x.erfasst_von = p_profil_id)
        or exists (select 1 from public.meetings x
                   where x.customer_id = c.id and x.berater_id = p_profil_id)
        or exists (select 1 from public.tickets x
                   where x.customer_id = c.id and x.zustaendig_id = p_profil_id)
      )
  )
$$;

-- Liegt das Datum in einem abgeschlossenen Monat dieses Kunden?
create or replace function app.monat_gesperrt(p_customer_id uuid, p_datum date)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.monatsabschluesse m
    where m.customer_id = p_customer_id
      and m.monat = to_char(p_datum, 'YYYY-MM')
      and m.status = 'abgeschlossen'
  )
$$;

-- Kunden-ID aus einem Storage-Pfad "<customer_id>/<meeting_id>/<datei>"
create or replace function app.pfad_kunde(p_name text)
returns uuid
language plpgsql
immutable
set search_path = ''
as $$
begin
  return split_part(p_name, '/', 1)::uuid;
exception when others then
  return null;
end;
$$;

revoke all on all functions in schema app from public;
grant execute on all functions in schema app to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Schutz-Trigger
-- -----------------------------------------------------------------------------

-- customer_id ist nach dem Anlegen unveränderlich (verhindert das "Verschieben"
-- von Datensätzen zu einem anderen Kunden).
create or replace function app.customer_id_fix()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.customer_id is distinct from old.customer_id then
    raise exception 'customer_id darf nicht geändert werden' using errcode = '42501';
  end if;
  return new;
end;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'kontingente', 'stories', 'tickets', 'time_entries', 'comments', 'meetings',
    'monatsabschluesse'
  ] loop
    execute format(
      'create trigger customer_id_fix before update on public.%I
         for each row execute function app.customer_id_fix()', t);
  end loop;
end;
$$;

-- Unveränderliche Protokolle: kein UPDATE / DELETE für niemanden.
create or replace function app.nur_insert()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'Tabelle % ist ein unveränderliches Protokoll (nur INSERT)', tg_table_name
    using errcode = '42501';
end;
$$;

create trigger nur_insert before update or delete on public.approvals
  for each row execute function app.nur_insert();
create trigger nur_insert before update or delete on public.audit_log
  for each row execute function app.nur_insert();
create trigger nur_insert_truncate before truncate on public.approvals
  for each statement execute function app.nur_insert();
create trigger nur_insert_truncate before truncate on public.audit_log
  for each statement execute function app.nur_insert();

-- profiles: Rolle, Status, E-Mail nur durch admin änderbar.
create or replace function app.profiles_schutz()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Serverseitige Wartung (service_role / Migrationen) ist ausgenommen.
  if auth.uid() is null then
    return new;
  end if;
  if new.id is distinct from old.id then
    raise exception 'id darf nicht geändert werden' using errcode = '42501';
  end if;
  if not app.ist_admin() and (
       new.rolle is distinct from old.rolle
       or new.aktiv is distinct from old.aktiv
       or new.email is distinct from old.email
     ) then
    raise exception 'Nur admin darf Rolle, Status oder E-Mail ändern' using errcode = '42501';
  end if;
  if new.rolle <> 'berater' and new.rolle <> 'admin' then
    new.buchungslink := null;
  end if;
  return new;
end;
$$;

create trigger profiles_schutz before update on public.profiles
  for each row execute function app.profiles_schutz();

-- customers: Kunden-Login muss Rolle "kunde", Hauptberater Rolle "berater"/"admin" haben.
create or replace function app.customers_pruefen()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.kunde_user_id is not null and not exists (
       select 1 from public.profiles p where p.id = new.kunde_user_id and p.rolle = 'kunde') then
    raise exception 'Kunden-Login muss ein Profil mit Rolle "kunde" sein' using errcode = '23514';
  end if;
  if new.hauptberater_id is not null and not exists (
       select 1 from public.profiles p
       where p.id = new.hauptberater_id and p.rolle in ('berater', 'admin')) then
    raise exception 'Hauptberater muss ein Profil mit Rolle "berater" sein' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger customers_pruefen before insert or update on public.customers
  for each row execute function app.customers_pruefen();

create or replace function app.customer_consultants_pruefen()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.profiles p
                 where p.id = new.berater_id and p.rolle in ('berater', 'admin')) then
    raise exception 'Zugeordnete Person muss die Rolle "berater" haben' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger customer_consultants_pruefen before insert or update on public.customer_consultants
  for each row execute function app.customer_consultants_pruefen();

-- Verknüpfungen müssen immer zum selben Kunden gehören.
create or replace function app.bezug_pruefen()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_story_id  uuid;
  v_ticket_id uuid;
begin
  v_story_id  := case when tg_table_name = 'stories' then null else (to_jsonb(new) ->> 'story_id')::uuid end;
  v_ticket_id := case when tg_table_name = 'tickets' then null else (to_jsonb(new) ->> 'ticket_id')::uuid end;

  if v_story_id is not null and not exists (
       select 1 from public.stories s where s.id = v_story_id and s.customer_id = new.customer_id) then
    raise exception 'Story gehört nicht zu diesem Kunden' using errcode = '23514';
  end if;
  if v_ticket_id is not null and not exists (
       select 1 from public.tickets t where t.id = v_ticket_id and t.customer_id = new.customer_id) then
    raise exception 'Ticket gehört nicht zu diesem Kunden' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger bezug_pruefen before insert or update on public.stories
  for each row execute function app.bezug_pruefen();
create trigger bezug_pruefen before insert or update on public.tickets
  for each row execute function app.bezug_pruefen();
create trigger bezug_pruefen before insert or update on public.time_entries
  for each row execute function app.bezug_pruefen();
create trigger bezug_pruefen before insert or update on public.comments
  for each row execute function app.bezug_pruefen();

-- Personen-Felder müssen auf interne Profile zeigen.
create or replace function app.intern_pruefen()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  v_id := case tg_table_name
            when 'meetings' then (to_jsonb(new) ->> 'berater_id')::uuid
            when 'tickets'  then (to_jsonb(new) ->> 'zustaendig_id')::uuid
            when 'time_entries' then (to_jsonb(new) ->> 'erfasst_von')::uuid
          end;
  if v_id is not null and not exists (
       select 1 from public.profiles p where p.id = v_id and p.rolle in ('admin', 'berater')) then
    raise exception 'Person muss ein Berater sein' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger intern_pruefen before insert or update on public.meetings
  for each row execute function app.intern_pruefen();
create trigger intern_pruefen before insert or update on public.tickets
  for each row execute function app.intern_pruefen();
create trigger intern_pruefen before insert or update on public.time_entries
  for each row execute function app.intern_pruefen();

-- Story-Status darf nur über public.story_transition() geändert werden.
-- (Zusätzlich zur fehlenden Spaltenberechtigung; greift auch, falls Rechte
-- versehentlich erweitert werden.)
create or replace function app.story_status_schutz()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' and (
       new.status is distinct from old.status
       or new.schaetzung_stunden is distinct from old.schaetzung_stunden
     ) then
    if coalesce(current_setting('app.story_transition', true), '') <> 'an' then
      raise exception 'Status und Schätzung nur über story_transition() änderbar'
        using errcode = '42501';
    end if;
  end if;
  if new.status is distinct from coalesce(old.status, new.status) then
    new.status_seit := now();
  end if;
  return new;
end;
$$;

create trigger story_status_schutz before update on public.stories
  for each row execute function app.story_status_schutz();

-- Stories werden immer als Entwurf angelegt; Ersteller = aktueller Nutzer.
create or replace function app.story_anlegen()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.erstellt_von := auth.uid();
    new.status := 'entwurf';
    new.schaetzung_stunden := null;
  end if;
  new.status_seit := now();
  return new;
end;
$$;

create trigger story_anlegen before insert on public.stories
  for each row execute function app.story_anlegen();

-- Tickets: Ersteller = aktueller Nutzer; Kunden legen immer mit Status "neu" an.
create or replace function app.ticket_schutz()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    if auth.uid() is not null then
      new.erstellt_von := auth.uid();
      if app.aktuelle_rolle() = 'kunde' then
        new.status := 'neu';
        new.story_id := null;
        new.zustaendig_id := null;
      end if;
    end if;
    new.status_seit := now();
  else
    if new.erstellt_von is distinct from old.erstellt_von and auth.uid() is not null then
      raise exception 'erstellt_von darf nicht geändert werden' using errcode = '42501';
    end if;
    if new.status is distinct from old.status then
      new.status_seit := now();
    end if;
  end if;
  return new;
end;
$$;

create trigger ticket_schutz before insert or update on public.tickets
  for each row execute function app.ticket_schutz();

-- Kommentare: Autor und Autor-Rolle werden serverseitig gesetzt.
create or replace function app.comment_anlegen()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is not null then
    new.autor_id := auth.uid();
    new.autor_rolle := app.aktuelle_rolle();
  elsif new.autor_rolle is null then
    select p.rolle into new.autor_rolle from public.profiles p where p.id = new.autor_id;
  end if;
  return new;
end;
$$;

create trigger comment_anlegen before insert on public.comments
  for each row execute function app.comment_anlegen();

-- Zeiten: abgeschlossene Monate sind für ALLE gesperrt (auch admin – der muss
-- den Monat erst wieder öffnen). erfasst_von bleibt beim ursprünglichen Erfasser.
create or replace function app.zeiten_schutz()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') and app.monat_gesperrt(old.customer_id, old.datum) then
    raise exception 'Der Monat % ist abgeschlossen; Zeiten sind gesperrt', to_char(old.datum, 'MM.YYYY')
      using errcode = '42501';
  end if;
  if tg_op in ('INSERT', 'UPDATE') and app.monat_gesperrt(new.customer_id, new.datum) then
    raise exception 'Der Monat % ist abgeschlossen; Zeiten sind gesperrt', to_char(new.datum, 'MM.YYYY')
      using errcode = '42501';
  end if;
  if tg_op = 'INSERT' and auth.uid() is not null and new.erfasst_von is null then
    new.erfasst_von := auth.uid();
  end if;
  if tg_op = 'UPDATE' and auth.uid() is not null and not app.ist_admin()
     and new.erfasst_von is distinct from old.erfasst_von then
    raise exception 'erfasst_von darf nicht geändert werden' using errcode = '42501';
  end if;
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

create trigger zeiten_schutz before insert or update or delete on public.time_entries
  for each row execute function app.zeiten_schutz();

-- -----------------------------------------------------------------------------
-- Grundrechte (Tabellen-/Spaltenebene). anon hat nirgends Zugriff.
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all tables in schema public from authenticated;

grant select, insert, update on public.profiles to authenticated;
revoke update on public.profiles from authenticated;
grant update (name, buchungslink, rolle, aktiv, email) on public.profiles to authenticated;

grant select, insert, update, delete on public.customers to authenticated;
grant select, insert, delete on public.customer_consultants to authenticated;
grant select, insert, update, delete on public.kontingente to authenticated;
grant select on public.kontingent_warnungen to authenticated;

grant select, insert, delete on public.stories to authenticated;
grant update (titel, beschreibung, akzeptanzkriterien, position) on public.stories to authenticated;

grant select, insert, delete on public.tickets to authenticated;
grant update (titel, beschreibung, typ, prioritaet, status, zustaendig_id, faellig_am)
  on public.tickets to authenticated;

grant select, insert, update, delete on public.time_entries to authenticated;
grant select, insert, delete on public.comments to authenticated;
grant select on public.approvals to authenticated;
grant select, insert, update, delete on public.meetings to authenticated;
grant select on public.monatsabschluesse to authenticated;
grant select on public.audit_log to authenticated;
grant select, delete on public.notifications to authenticated;
grant update (gelesen) on public.notifications to authenticated;
-- email_outbox: keinerlei Rechte für Clients.

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles             enable row level security;
alter table public.customers            enable row level security;
alter table public.customer_consultants enable row level security;
alter table public.kontingente          enable row level security;
alter table public.kontingent_warnungen enable row level security;
alter table public.stories              enable row level security;
alter table public.tickets              enable row level security;
alter table public.time_entries         enable row level security;
alter table public.comments             enable row level security;
alter table public.approvals            enable row level security;
alter table public.meetings             enable row level security;
alter table public.monatsabschluesse    enable row level security;
alter table public.audit_log            enable row level security;
alter table public.notifications        enable row level security;
alter table public.email_outbox         enable row level security;

-- profiles
create policy profiles_select on public.profiles for select to authenticated
  using (
    id = auth.uid()
    or coalesce(app.aktuelle_rolle() in ('admin', 'customer_success'), false)
    -- Berater: alle internen Profile, Kunden-Logins nur zugeordneter Kunden
    or (app.aktuelle_rolle() = 'berater' and (
          rolle <> 'kunde'
          or exists (select 1 from public.customers c
                     where c.kunde_user_id = profiles.id and app.ist_berater_von(c.id))
       ))
    or (app.aktuelle_rolle() = 'kunde' and app.kunde_sieht_profil(id))
  );
create policy profiles_insert on public.profiles for insert to authenticated
  with check (app.ist_admin());
create policy profiles_update on public.profiles for update to authenticated
  using ((id = auth.uid() and app.aktuelle_rolle() is not null) or app.ist_admin())
  with check ((id = auth.uid() and app.aktuelle_rolle() is not null) or app.ist_admin());

-- customers
create policy customers_select on public.customers for select to authenticated
  using (app.darf_lesen(id));
create policy customers_insert on public.customers for insert to authenticated
  with check (app.ist_admin());
create policy customers_update on public.customers for update to authenticated
  using (app.ist_admin()) with check (app.ist_admin());
create policy customers_delete on public.customers for delete to authenticated
  using (app.ist_admin());

-- customer_consultants
create policy cc_select on public.customer_consultants for select to authenticated
  using (app.darf_lesen(customer_id));
create policy cc_insert on public.customer_consultants for insert to authenticated
  with check (app.ist_admin());
create policy cc_delete on public.customer_consultants for delete to authenticated
  using (app.ist_admin());

-- kontingente: admin und Berater des Kunden pflegen
create policy kontingente_select on public.kontingente for select to authenticated
  using (app.darf_lesen(customer_id));
create policy kontingente_insert on public.kontingente for insert to authenticated
  with check (app.darf_bearbeiten(customer_id));
create policy kontingente_update on public.kontingente for update to authenticated
  using (app.darf_bearbeiten(customer_id)) with check (app.darf_bearbeiten(customer_id));
create policy kontingente_delete on public.kontingente for delete to authenticated
  using (app.darf_bearbeiten(customer_id));

-- kontingent_warnungen: nur intern lesbar, Pflege per Trigger
create policy kw_select on public.kontingent_warnungen for select to authenticated
  using (app.ist_intern() and app.darf_lesen(customer_id));

-- stories
create policy stories_select on public.stories for select to authenticated
  using (app.darf_lesen(customer_id));
create policy stories_insert on public.stories for insert to authenticated
  with check (app.darf_mitwirken(customer_id) and status = 'entwurf');
create policy stories_update on public.stories for update to authenticated
  using (
    app.darf_bearbeiten(customer_id)
    or (app.ist_kunde_von(customer_id) and status = 'entwurf')
  )
  with check (
    app.darf_bearbeiten(customer_id)
    or (app.ist_kunde_von(customer_id) and status = 'entwurf')
  );
create policy stories_delete on public.stories for delete to authenticated
  using (
    app.darf_bearbeiten(customer_id)
    or (app.ist_kunde_von(customer_id) and status = 'entwurf' and erstellt_von = auth.uid())
  );

-- tickets
create policy tickets_select on public.tickets for select to authenticated
  using (app.darf_lesen(customer_id));
create policy tickets_insert on public.tickets for insert to authenticated
  with check (app.darf_mitwirken(customer_id));
create policy tickets_update on public.tickets for update to authenticated
  using (app.darf_bearbeiten(customer_id)) with check (app.darf_bearbeiten(customer_id));
create policy tickets_delete on public.tickets for delete to authenticated
  using (app.ist_admin());

-- time_entries: nur Berater des Kunden und admin schreiben
create policy te_select on public.time_entries for select to authenticated
  using (app.darf_lesen(customer_id));
create policy te_insert on public.time_entries for insert to authenticated
  with check (
    app.darf_bearbeiten(customer_id)
    and (erfasst_von = auth.uid() or app.ist_admin())
  );
create policy te_update on public.time_entries for update to authenticated
  using (app.darf_bearbeiten(customer_id)) with check (app.darf_bearbeiten(customer_id));
create policy te_delete on public.time_entries for delete to authenticated
  using (app.darf_bearbeiten(customer_id));

-- comments
create policy comments_select on public.comments for select to authenticated
  using (app.darf_lesen(customer_id));
create policy comments_insert on public.comments for insert to authenticated
  with check (app.darf_mitwirken(customer_id) and autor_id = auth.uid());
create policy comments_delete on public.comments for delete to authenticated
  using (app.ist_admin());

-- approvals: lesen ja, schreiben nur über story_transition()
create policy approvals_select on public.approvals for select to authenticated
  using (app.darf_lesen(customer_id));

-- meetings
create policy meetings_select on public.meetings for select to authenticated
  using (app.darf_lesen(customer_id));
create policy meetings_insert on public.meetings for insert to authenticated
  with check (app.darf_bearbeiten(customer_id));
create policy meetings_update on public.meetings for update to authenticated
  using (app.darf_bearbeiten(customer_id)) with check (app.darf_bearbeiten(customer_id));
create policy meetings_delete on public.meetings for delete to authenticated
  using (app.darf_bearbeiten(customer_id));

-- monatsabschluesse: rein intern (admin + Berater des Kunden), Schreiben nur per Funktion
create policy ma_select on public.monatsabschluesse for select to authenticated
  using (app.darf_bearbeiten(customer_id));

-- audit_log: nur admin liest, Schreiben nur per Funktion
create policy audit_select on public.audit_log for select to authenticated
  using (app.ist_admin());

-- notifications: nur eigene
create policy notifications_select on public.notifications for select to authenticated
  using (user_id = auth.uid());
create policy notifications_update on public.notifications for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy notifications_delete on public.notifications for delete to authenticated
  using (user_id = auth.uid());

-- email_outbox: keine Policies => für Clients unsichtbar
