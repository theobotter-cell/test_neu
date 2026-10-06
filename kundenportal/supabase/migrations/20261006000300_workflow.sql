-- =============================================================================
-- Linxys Kundenportal – Workflows, Benachrichtigungen, Kontingentwarnungen,
-- Monatsabschluss, administrative Vorgänge
-- =============================================================================
-- Alle öffentlich aufrufbaren Funktionen (RPC) sind SECURITY DEFINER, prüfen
-- Rolle und Kundenzugriff selbst und schreiben Protokolle im selben Vorgang.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Audit-Log (nur intern, nur INSERT)
-- -----------------------------------------------------------------------------
create or replace function app.audit(p_aktion text, p_objekt_typ text, p_objekt_id text, p_details jsonb)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.audit_log (user_id, aktion, objekt_typ, objekt_id, details)
  values (auth.uid(), p_aktion, p_objekt_typ, p_objekt_id, coalesce(p_details, '{}'::jsonb))
$$;

-- Automatisches Protokoll administrativer Stammdatenänderungen
create or replace function app.audit_stammdaten()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id   text;
  v_alt  jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_neu  jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
begin
  v_id := coalesce(v_neu ->> 'id', v_alt ->> 'id',
                   coalesce(v_neu, v_alt) ->> 'customer_id');
  if tg_op = 'UPDATE' then
    -- Nur geänderte Felder protokollieren (ohne updated_at)
    select jsonb_object_agg(n.key, jsonb_build_object('alt', v_alt -> n.key, 'neu', n.value))
      into v_neu
      from jsonb_each(v_neu) n
     where n.key <> 'updated_at' and (v_alt -> n.key) is distinct from n.value;
    if v_neu is null then
      return new;
    end if;
    perform app.audit(tg_table_name || '_geaendert', tg_table_name, v_id, v_neu);
  elsif tg_op = 'INSERT' then
    perform app.audit(tg_table_name || '_angelegt', tg_table_name, v_id, v_neu);
  else
    perform app.audit(tg_table_name || '_geloescht', tg_table_name, v_id, v_alt);
  end if;
  return coalesce(new, old);
end;
$$;

create trigger audit_stammdaten after insert or update or delete on public.customers
  for each row execute function app.audit_stammdaten();
create trigger audit_stammdaten after insert or delete on public.customer_consultants
  for each row execute function app.audit_stammdaten();
create trigger audit_stammdaten after insert or update or delete on public.kontingente
  for each row execute function app.audit_stammdaten();
create trigger audit_stammdaten after insert or update of rolle, aktiv, email on public.profiles
  for each row execute function app.audit_stammdaten();

-- -----------------------------------------------------------------------------
-- Benachrichtigungen (In-App + E-Mail-Warteschlange)
-- -----------------------------------------------------------------------------
create or replace function app.benachrichtigen(
  p_user_id     uuid,
  p_typ         text,
  p_text        text,
  p_link        text,
  p_email       boolean,
  p_auch_selbst boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_user_id is null then
    return;
  end if;
  -- Niemand wird über die eigene Aktion benachrichtigt.
  if not p_auch_selbst and p_user_id = auth.uid() then
    return;
  end if;
  if not exists (select 1 from public.profiles p where p.id = p_user_id and p.aktiv) then
    return;
  end if;

  insert into public.notifications (user_id, typ, text, link)
  values (p_user_id, p_typ, p_text, p_link);

  if p_email then
    insert into public.email_outbox (user_id, typ, betreff, text, link)
    values (p_user_id, p_typ, p_text, p_text, p_link);
  end if;
end;
$$;

create or replace function app.kunde_benachrichtigen(
  p_customer_id uuid, p_typ text, p_text text, p_link text, p_email boolean,
  p_auch_selbst boolean default false
)
returns void
language sql
security definer
set search_path = ''
as $$
  select app.benachrichtigen(c.kunde_user_id, p_typ, p_text, p_link, p_email, p_auch_selbst)
  from public.customers c
  where c.id = p_customer_id
$$;

-- Hauptberater und alle zugeordneten Berater
create or replace function app.berater_benachrichtigen(
  p_customer_id uuid, p_typ text, p_text text, p_link text, p_email boolean,
  p_auch_selbst boolean default false
)
returns void
language sql
security definer
set search_path = ''
as $$
  select app.benachrichtigen(b.id, p_typ, p_text, p_link, p_email, p_auch_selbst)
  from (
    select c.hauptberater_id as id from public.customers c where c.id = p_customer_id
    union
    select cc.berater_id from public.customer_consultants cc where cc.customer_id = p_customer_id
  ) b
  where b.id is not null
$$;

-- -----------------------------------------------------------------------------
-- Story-Workflow
-- -----------------------------------------------------------------------------
-- Einzige Quelle der erlaubten Übergänge (die Oberfläche spiegelt diese
-- Tabelle nur, maßgeblich ist immer diese Funktion).
create or replace function app.story_uebergang(
  p_von public.story_status,
  p_nach public.story_status,
  out rolle text,
  out aktion text,
  out kommentar_pflicht boolean,
  out schaetzung_pflicht boolean
)
returns record
language sql
immutable
set search_path = ''
as $$
  select r.rolle, r.aktion, r.kp, r.sp
  from (values
    ('entwurf',                    'zur_schaetzung_freigegeben', 'kunde',   'zur_schaetzung_freigegeben', false, false),
    ('zur_schaetzung_freigegeben', 'geschaetzt',                 'berater', 'geschaetzt',                 false, true),
    ('geschaetzt',                 'zur_umsetzung_freigegeben',  'kunde',   'zur_umsetzung_freigegeben',  false, false),
    ('geschaetzt',                 'entwurf',                    'kunde',   'schaetzung_abgelehnt',       true,  false),
    ('zur_umsetzung_freigegeben',  'in_umsetzung',               'berater', 'umsetzung_begonnen',         false, false),
    ('in_umsetzung',               'zur_abnahme',                'berater', 'zur_abnahme_gestellt',       false, false),
    ('zur_abnahme',                'abgenommen',                 'kunde',   'abgenommen',                 false, false),
    ('zur_abnahme',                'in_umsetzung',               'kunde',   'abnahme_abgelehnt',          true,  false)
  ) as r(von, nach, rolle, aktion, kp, sp)
  where r.von::public.story_status = p_von
    and r.nach::public.story_status = p_nach
$$;

create or replace function public.story_transition(
  p_story_id    uuid,
  p_nach_status public.story_status,
  p_kommentar   text default null,
  p_schaetzung  numeric default null
)
returns public.stories
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_story   public.stories;
  v_von     public.story_status;
  v_ue      record;
  v_erlaubt boolean;
begin
  if app.aktuelle_rolle() is null then
    raise exception 'Nicht angemeldet oder deaktiviert' using errcode = '42501';
  end if;

  select * into v_story from public.stories where id = p_story_id for update;
  if not found or not app.darf_lesen(v_story.customer_id) then
    raise exception 'Story nicht gefunden' using errcode = 'P0002';
  end if;

  v_von := v_story.status;
  select * into v_ue from app.story_uebergang(v_von, p_nach_status);
  if v_ue.aktion is null then
    raise exception 'Übergang von "%" nach "%" ist nicht erlaubt', v_story.status, p_nach_status
      using errcode = '42501';
  end if;

  v_erlaubt := case v_ue.rolle
    when 'kunde'   then app.ist_kunde_von(v_story.customer_id) or app.ist_admin()
    when 'berater' then app.darf_bearbeiten(v_story.customer_id)
    else false
  end;
  if not v_erlaubt then
    raise exception 'Dieser Übergang ist für Ihre Rolle nicht erlaubt' using errcode = '42501';
  end if;

  if v_ue.kommentar_pflicht and coalesce(btrim(p_kommentar), '') = '' then
    raise exception 'Für diesen Schritt ist ein Kommentar erforderlich' using errcode = '23514';
  end if;
  if v_ue.schaetzung_pflicht and (p_schaetzung is null or p_schaetzung <= 0) then
    raise exception 'Bitte eine Schätzung in Stunden angeben' using errcode = '23514';
  end if;

  perform set_config('app.story_transition', 'an', true);
  update public.stories
     set status = p_nach_status,
         schaetzung_stunden = case when v_ue.schaetzung_pflicht then p_schaetzung
                                   else schaetzung_stunden end
   where id = p_story_id
  returning * into v_story;
  perform set_config('app.story_transition', '', true);

  insert into public.approvals (customer_id, story_id, aktion, von_status, nach_status, user_id, kommentar)
  values (v_story.customer_id, v_story.id, v_ue.aktion, v_von, p_nach_status,
          auth.uid(), nullif(btrim(p_kommentar), ''));
  return v_story;
end;
$$;

-- Benachrichtigungen zu Story-Statuswechseln
create or replace function app.approval_benachrichtigen()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_titel text;
  v_link  text;
begin
  select s.titel into v_titel from public.stories s where s.id = new.story_id;
  v_link := '/k/' || new.customer_id || '/stories/' || new.story_id;

  case new.aktion
    when 'geschaetzt' then
      perform app.kunde_benachrichtigen(new.customer_id, 'story_geschaetzt',
        format('Story "%s" wurde geschätzt und wartet auf Ihre Freigabe', v_titel), v_link, true);
    when 'zur_abnahme_gestellt' then
      perform app.kunde_benachrichtigen(new.customer_id, 'story_zur_abnahme',
        format('Story "%s" wartet auf Ihre Abnahme', v_titel), v_link, true);
    when 'umsetzung_begonnen' then
      perform app.kunde_benachrichtigen(new.customer_id, 'story_in_umsetzung',
        format('Die Umsetzung von "%s" hat begonnen', v_titel), v_link, false);
    when 'zur_schaetzung_freigegeben' then
      perform app.berater_benachrichtigen(new.customer_id, 'story_zur_schaetzung',
        format('Story "%s" wurde zur Schätzung freigegeben', v_titel), v_link, true);
    when 'zur_umsetzung_freigegeben' then
      perform app.berater_benachrichtigen(new.customer_id, 'story_zur_umsetzung',
        format('Story "%s" wurde zur Umsetzung freigegeben', v_titel), v_link, true);
    when 'abgenommen' then
      perform app.berater_benachrichtigen(new.customer_id, 'story_abgenommen',
        format('Story "%s" wurde abgenommen', v_titel), v_link, true);
    when 'schaetzung_abgelehnt' then
      perform app.berater_benachrichtigen(new.customer_id, 'schaetzung_abgelehnt',
        format('Schätzung für "%s" wurde abgelehnt: %s', v_titel, new.kommentar), v_link, true);
    when 'abnahme_abgelehnt' then
      perform app.berater_benachrichtigen(new.customer_id, 'abnahme_abgelehnt',
        format('Abnahme von "%s" wurde abgelehnt: %s', v_titel, new.kommentar), v_link, true);
    else
      null;
  end case;
  return new;
end;
$$;

create trigger approval_benachrichtigen after insert on public.approvals
  for each row execute function app.approval_benachrichtigen();

-- Neue Story: jeweils die andere Seite (nur In-App)
create or replace function app.story_neu_benachrichtigen()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link text := '/k/' || new.customer_id || '/stories/' || new.id;
begin
  if exists (select 1 from public.profiles p where p.id = new.erstellt_von and p.rolle = 'kunde') then
    perform app.berater_benachrichtigen(new.customer_id, 'story_neu',
      format('Neue Story vom Kunden: "%s"', new.titel), v_link, false);
  else
    perform app.kunde_benachrichtigen(new.customer_id, 'story_neu',
      format('Neue Story: "%s"', new.titel), v_link, false);
  end if;
  return new;
end;
$$;

create trigger story_neu_benachrichtigen after insert on public.stories
  for each row execute function app.story_neu_benachrichtigen();

-- -----------------------------------------------------------------------------
-- Tickets
-- -----------------------------------------------------------------------------
create or replace function app.ticket_benachrichtigen()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_link text := '/k/' || new.customer_id || '/tickets/' || new.id;
begin
  if tg_op = 'INSERT' then
    if exists (select 1 from public.profiles p where p.id = new.erstellt_von and p.rolle = 'kunde') then
      perform app.berater_benachrichtigen(new.customer_id, 'ticket_neu',
        format('Neues Ticket vom Kunden: "%s"', new.titel), v_link, true);
    else
      perform app.kunde_benachrichtigen(new.customer_id, 'ticket_neu',
        format('Neues Ticket: "%s"', new.titel), v_link, false);
    end if;
  elsif new.status is distinct from old.status then
    if new.status = 'wartet_auf_kunde' then
      perform app.kunde_benachrichtigen(new.customer_id, 'ticket_wartet_auf_kunde',
        format('Ticket "%s" wartet auf Ihre Rückmeldung', new.titel), v_link, true);
    elsif new.status = 'erledigt' then
      perform app.kunde_benachrichtigen(new.customer_id, 'ticket_erledigt',
        format('Ticket "%s" wurde erledigt', new.titel), v_link, false);
    end if;
  end if;
  return new;
end;
$$;

create trigger ticket_benachrichtigen after insert or update of status on public.tickets
  for each row execute function app.ticket_benachrichtigen();

-- Berater wandelt ein Ticket in eine Story um
create or replace function public.ticket_in_story_umwandeln(p_ticket_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ticket   public.tickets;
  v_story_id uuid;
begin
  select * into v_ticket from public.tickets where id = p_ticket_id for update;
  if not found or not app.darf_lesen(v_ticket.customer_id) then
    raise exception 'Ticket nicht gefunden' using errcode = 'P0002';
  end if;
  if not app.darf_bearbeiten(v_ticket.customer_id) then
    raise exception 'Nur Berater dürfen Tickets umwandeln' using errcode = '42501';
  end if;
  if v_ticket.story_id is not null then
    raise exception 'Ticket wurde bereits in eine Story umgewandelt' using errcode = '23514';
  end if;

  insert into public.stories (customer_id, titel, beschreibung, ticket_id, erstellt_von, position)
  values (
    v_ticket.customer_id, v_ticket.titel, v_ticket.beschreibung, v_ticket.id, auth.uid(),
    coalesce((select max(s.position) + 1 from public.stories s
              where s.customer_id = v_ticket.customer_id and s.status = 'entwurf'), 0)
  )
  returning id into v_story_id;

  update public.tickets
     set story_id = v_story_id,
         status = 'erledigt'
   where id = v_ticket.id;

  return v_story_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Kommentare
-- -----------------------------------------------------------------------------
create or replace function app.comment_nach_anlage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_titel text;
  v_link  text;
begin
  if new.story_id is not null then
    select s.titel into v_titel from public.stories s where s.id = new.story_id;
    v_link := '/k/' || new.customer_id || '/stories/' || new.story_id;
  else
    select t.titel into v_titel from public.tickets t where t.id = new.ticket_id;
    v_link := '/k/' || new.customer_id || '/tickets/' || new.ticket_id;
  end if;

  if new.autor_rolle = 'kunde' then
    perform app.berater_benachrichtigen(new.customer_id, 'kommentar_kunde',
      format('Neuer Kommentar des Kunden zu "%s"', v_titel), v_link, true);
    -- Antwort des Kunden auf ein wartendes Ticket => zurück in Arbeit
    if new.ticket_id is not null then
      update public.tickets
         set status = 'in_arbeit'
       where id = new.ticket_id
         and status = 'wartet_auf_kunde';
    end if;
  else
    perform app.kunde_benachrichtigen(new.customer_id, 'kommentar_berater',
      format('Neuer Kommentar zu "%s"', v_titel), v_link, true);
  end if;
  return new;
end;
$$;

create trigger comment_nach_anlage after insert on public.comments
  for each row execute function app.comment_nach_anlage();

-- -----------------------------------------------------------------------------
-- Termine
-- -----------------------------------------------------------------------------
create or replace function app.meeting_benachrichtigen()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hat_transkript boolean :=
    coalesce(btrim(new.transkript), '') <> '' or new.transkript_datei is not null;
  v_hatte_transkript boolean := false;
begin
  if tg_op = 'UPDATE' then
    v_hatte_transkript := coalesce(btrim(old.transkript), '') <> '' or old.transkript_datei is not null;
  end if;
  if v_hat_transkript and not v_hatte_transkript then
    perform app.kunde_benachrichtigen(new.customer_id, 'termin_neu',
      format('Neuer Termin mit Transkript: "%s" vom %s', new.titel, to_char(new.datum, 'DD.MM.YYYY')),
      '/k/' || new.customer_id || '/termine/' || new.id, true);
  end if;
  return new;
end;
$$;

create trigger meeting_benachrichtigen after insert or update of transkript, transkript_datei on public.meetings
  for each row execute function app.meeting_benachrichtigen();

-- -----------------------------------------------------------------------------
-- Kontingentwarnungen (80 % / 100 %)
-- -----------------------------------------------------------------------------
create or replace function app.kontingent_schwellen()
returns integer[]
language sql
immutable
set search_path = ''
as $$
  select array[100, 80]  -- absteigend; zentral hier konfiguriert
$$;

create or replace function app.kontingent_pruefen(p_customer_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_gesamt     numeric;
  v_verbraucht numeric;
  v_quote      numeric;
  v_schwelle   integer;
  v_neu        integer;
  v_gemeldet   boolean := false;
begin
  if p_customer_id is null or not exists (select 1 from public.customers where id = p_customer_id) then
    return;
  end if;

  select coalesce(sum(k.stunden), 0) into v_gesamt
    from public.kontingente k where k.customer_id = p_customer_id;
  select coalesce(sum(t.dauer_stunden), 0) into v_verbraucht
    from public.time_entries t where t.customer_id = p_customer_id and t.abrechenbar;

  -- Ohne gebuchtes Kontingent gibt es nichts zu warnen.
  if v_gesamt <= 0 then
    return;
  end if;
  v_quote := v_verbraucht / v_gesamt * 100;

  foreach v_schwelle in array app.kontingent_schwellen() loop
    if v_quote >= v_schwelle then
      insert into public.kontingent_warnungen (customer_id, schwelle)
      values (p_customer_id, v_schwelle)
      on conflict (customer_id, schwelle) do nothing;
      get diagnostics v_neu = row_count;
      -- Pro Vorgang nur die höchste neu erreichte Schwelle melden
      if v_neu > 0 and not v_gemeldet then
        v_gemeldet := true;
        perform app.kunde_benachrichtigen(p_customer_id, 'kontingent_' || v_schwelle,
          format('Ihr Stundenkontingent ist zu %s %% verbraucht (Rest: %s h)',
                 v_schwelle, replace(to_char(v_gesamt - v_verbraucht, 'FM999990.00'), '.', ',')),
          '/k/' || p_customer_id, true, true);
        perform app.berater_benachrichtigen(p_customer_id, 'kontingent_' || v_schwelle,
          format('Kontingent von %s ist zu %s %% verbraucht',
                 (select c.firmenname from public.customers c where c.id = p_customer_id), v_schwelle),
          '/k/' || p_customer_id || '/kontingente', true, true);
      end if;
    else
      -- Verbrauch wieder unter der Schwelle (z. B. neues Kontingent) => zurücksetzen
      delete from public.kontingent_warnungen
       where customer_id = p_customer_id and schwelle = v_schwelle;
    end if;
  end loop;
end;
$$;

create or replace function app.kontingent_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    perform app.kontingent_pruefen(old.customer_id);
  end if;
  if tg_op in ('INSERT', 'UPDATE') and (tg_op = 'INSERT' or new.customer_id is distinct from old.customer_id) then
    perform app.kontingent_pruefen(new.customer_id);
  end if;
  return null;
end;
$$;

create trigger kontingent_pruefen after insert or update or delete on public.time_entries
  for each row execute function app.kontingent_trigger();
create trigger kontingent_pruefen after insert or update or delete on public.kontingente
  for each row execute function app.kontingent_trigger();

-- -----------------------------------------------------------------------------
-- Monatsabschluss (rein intern)
-- -----------------------------------------------------------------------------
create or replace function public.monat_abschliessen(p_customer_id uuid, p_monat text)
returns public.monatsabschluesse
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ergebnis public.monatsabschluesse;
begin
  if not app.darf_bearbeiten(p_customer_id) then
    raise exception 'Keine Berechtigung für diesen Kunden' using errcode = '42501';
  end if;
  if p_monat !~ '^[0-9]{4}-(0[1-9]|1[0-2])$' then
    raise exception 'Ungültiger Monat (erwartet JJJJ-MM)' using errcode = '22023';
  end if;
  if p_monat > to_char(current_date, 'YYYY-MM') then
    raise exception 'Zukünftige Monate können nicht abgeschlossen werden' using errcode = '22023';
  end if;

  insert into public.monatsabschluesse (customer_id, monat, status, abgeschlossen_von, abgeschlossen_am)
  values (p_customer_id, p_monat, 'abgeschlossen', auth.uid(), now())
  on conflict (customer_id, monat) do update
     set status = 'abgeschlossen',
         abgeschlossen_von = excluded.abgeschlossen_von,
         abgeschlossen_am = excluded.abgeschlossen_am
   where public.monatsabschluesse.status = 'offen'
  returning * into v_ergebnis;

  if v_ergebnis.id is null then
    raise exception 'Der Monat ist bereits abgeschlossen' using errcode = '23514';
  end if;

  perform app.audit('monat_abgeschlossen', 'monatsabschluesse', v_ergebnis.id::text,
    jsonb_build_object('customer_id', p_customer_id, 'monat', p_monat));
  return v_ergebnis;
end;
$$;

create or replace function public.monat_wiedereroeffnen(p_customer_id uuid, p_monat text, p_grund text)
returns public.monatsabschluesse
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ergebnis public.monatsabschluesse;
begin
  if not app.ist_admin() then
    raise exception 'Nur admin darf Monate wieder öffnen' using errcode = '42501';
  end if;
  if coalesce(btrim(p_grund), '') = '' then
    raise exception 'Bitte einen Grund angeben' using errcode = '23514';
  end if;

  update public.monatsabschluesse
     set status = 'offen',
         abgeschlossen_von = null,
         abgeschlossen_am = null
   where customer_id = p_customer_id
     and monat = p_monat
     and status = 'abgeschlossen'
  returning * into v_ergebnis;

  if v_ergebnis.id is null then
    raise exception 'Der Monat ist nicht abgeschlossen' using errcode = 'P0002';
  end if;

  perform app.audit('monat_wiedereroeffnet', 'monatsabschluesse', v_ergebnis.id::text,
    jsonb_build_object('customer_id', p_customer_id, 'monat', p_monat, 'grund', btrim(p_grund)));
  return v_ergebnis;
end;
$$;

-- -----------------------------------------------------------------------------
-- Ansprechpartner (Kunden-Login) wechseln – nur admin
-- -----------------------------------------------------------------------------
create or replace function public.kunde_login_wechseln(p_customer_id uuid, p_neuer_user_id uuid)
returns public.customers
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_kunde public.customers;
  v_alt   uuid;
begin
  if not app.ist_admin() then
    raise exception 'Nur admin darf den Ansprechpartner wechseln' using errcode = '42501';
  end if;

  select * into v_kunde from public.customers where id = p_customer_id for update;
  if not found then
    raise exception 'Kunde nicht gefunden' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.profiles p
                 where p.id = p_neuer_user_id and p.rolle = 'kunde' and p.aktiv) then
    raise exception 'Neuer Login muss ein aktives Profil mit Rolle "kunde" sein' using errcode = '23514';
  end if;
  if exists (select 1 from public.customers c
             where c.kunde_user_id = p_neuer_user_id and c.id <> p_customer_id) then
    raise exception 'Dieser Login ist bereits einem anderen Kunden zugeordnet' using errcode = '23514';
  end if;

  v_alt := v_kunde.kunde_user_id;
  if v_alt = p_neuer_user_id then
    return v_kunde;
  end if;

  update public.customers set kunde_user_id = p_neuer_user_id
   where id = p_customer_id
  returning * into v_kunde;

  if v_alt is not null then
    update public.profiles set aktiv = false where id = v_alt;
  end if;

  perform app.audit('ansprechpartner_gewechselt', 'customers', p_customer_id::text,
    jsonb_build_object('alter_login', v_alt, 'neuer_login', p_neuer_user_id));
  return v_kunde;
end;
$$;

-- -----------------------------------------------------------------------------
-- Ausführungsrechte: nur angemeldete Nutzer (Prüfung erfolgt in der Funktion)
-- -----------------------------------------------------------------------------
-- Im Schema app dürfen Clients nur die in Policies verwendeten Prüffunktionen
-- ausführen. Interne Funktionen (Benachrichtigen, Audit, ...) laufen nur über
-- SECURITY-DEFINER-Funktionen und Trigger.
revoke all on all functions in schema app from public, anon, authenticated;
grant execute on function
  app.aktuelle_rolle(), app.ist_admin(), app.ist_intern(),
  app.ist_berater_von(uuid), app.ist_kunde_von(uuid),
  app.darf_lesen(uuid), app.darf_bearbeiten(uuid), app.darf_mitwirken(uuid),
  app.kunde_sieht_profil(uuid), app.monat_gesperrt(uuid, date), app.pfad_kunde(text)
  to authenticated;
grant execute on all functions in schema app to service_role;

revoke all on function public.story_transition(uuid, public.story_status, text, numeric) from public, anon;
revoke all on function public.ticket_in_story_umwandeln(uuid) from public, anon;
revoke all on function public.monat_abschliessen(uuid, text) from public, anon;
revoke all on function public.monat_wiedereroeffnen(uuid, text, text) from public, anon;
revoke all on function public.kunde_login_wechseln(uuid, uuid) from public, anon;

grant execute on function public.story_transition(uuid, public.story_status, text, numeric) to authenticated;
grant execute on function public.ticket_in_story_umwandeln(uuid) to authenticated;
grant execute on function public.monat_abschliessen(uuid, text) to authenticated;
grant execute on function public.monat_wiedereroeffnen(uuid, text, text) to authenticated;
grant execute on function public.kunde_login_wechseln(uuid, uuid) to authenticated;
