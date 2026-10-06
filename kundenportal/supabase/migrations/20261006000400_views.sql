-- =============================================================================
-- Linxys Kundenportal – Auswertungs-Views
-- =============================================================================
-- Alle Views laufen mit security_invoker = true: Es gelten die RLS-Regeln des
-- abfragenden Nutzers. Ein Kunde sieht damit nur seine eigenen Kennzahlen.
-- =============================================================================

-- Kontingentstand: Gesamt = Summe Kontingente, Verbraucht = Summe abrechenbarer Zeiten
create view public.kontingent_stand
with (security_invoker = true)
as
select
  c.id                                                    as customer_id,
  coalesce(k.gesamt, 0)::numeric(10, 2)                   as gesamt,
  coalesce(t.beratung, 0)::numeric(10, 2)                 as verbraucht_beratung,
  coalesce(t.entwicklung, 0)::numeric(10, 2)              as verbraucht_entwicklung,
  (coalesce(t.beratung, 0) + coalesce(t.entwicklung, 0))::numeric(10, 2) as verbraucht,
  (coalesce(k.gesamt, 0) - coalesce(t.beratung, 0) - coalesce(t.entwicklung, 0))::numeric(10, 2) as rest
from public.customers c
left join lateral (
  select sum(x.stunden) as gesamt
  from public.kontingente x
  where x.customer_id = c.id
) k on true
left join lateral (
  select
    sum(x.dauer_stunden) filter (where x.kategorie = 'beratung')    as beratung,
    sum(x.dauer_stunden) filter (where x.kategorie = 'entwicklung') as entwicklung
  from public.time_entries x
  where x.customer_id = c.id
    and x.abrechenbar
) t on true;

-- Kennzahlen je Kunde für Berater- und Customer-Success-Dashboard.
-- Schwellenwerte (20 %, 21 Tage, 7 Tage, 30 Tage) werden in der Anwendung
-- zentral angewendet (src/lib/config.ts); die View liefert Rohwerte.
create view public.kunden_kennzahlen
with (security_invoker = true)
as
select
  c.id as customer_id,
  c.firmenname,
  c.hauptberater_id,
  ks.gesamt,
  ks.verbraucht,
  ks.rest,
  case when ks.gesamt > 0 then round(ks.rest / ks.gesamt * 100, 1) end as rest_prozent,
  (select count(*) from public.stories s
    where s.customer_id = c.id and s.status <> 'abgenommen')::int as offene_stories,
  (select count(*) from public.tickets t
    where t.customer_id = c.id and t.status <> 'erledigt')::int as offene_tickets,
  ((select count(*) from public.stories s
     where s.customer_id = c.id and s.status in ('geschaetzt', 'zur_abnahme'))
   + (select count(*) from public.tickets t
       where t.customer_id = c.id and t.status = 'wartet_auf_kunde'))::int as wartet_auf_kunde,
  ((select count(*) from public.stories s
     where s.customer_id = c.id and s.status in ('zur_schaetzung_freigegeben', 'zur_umsetzung_freigegeben'))
   + (select count(*) from public.tickets t
       where t.customer_id = c.id and t.status = 'neu'))::int as wartet_auf_berater,
  least(
    (select min(s.status_seit) from public.stories s
      where s.customer_id = c.id and s.status in ('geschaetzt', 'zur_abnahme')),
    (select min(t.status_seit) from public.tickets t
      where t.customer_id = c.id and t.status = 'wartet_auf_kunde')
  ) as wartet_beim_kunden_seit,
  greatest(
    (select max(x.datum)::timestamptz from public.time_entries x where x.customer_id = c.id),
    (select max(x.created_at) from public.time_entries x where x.customer_id = c.id),
    (select max(x.created_at) from public.comments x where x.customer_id = c.id),
    (select max(x.created_at) from public.tickets x where x.customer_id = c.id)
  ) as letzte_aktivitaet,
  (select max(a.created_at) from public.approvals a
    where a.customer_id = c.id
      and a.aktion in ('schaetzung_abgelehnt', 'abnahme_abgelehnt')) as letzte_ablehnung_am
from public.customers c
join public.kontingent_stand ks on ks.customer_id = c.id;

-- Kundenkommentare, auf die noch kein interner Kommentar folgte
create view public.offene_kundenkommentare
with (security_invoker = true)
as
select
  c.id,
  c.customer_id,
  c.story_id,
  c.ticket_id,
  coalesce(s.titel, t.titel) as titel,
  c.text,
  c.created_at
from public.comments c
left join public.stories s on s.id = c.story_id
left join public.tickets t on t.id = c.ticket_id
where c.autor_rolle = 'kunde'
  and not exists (
    select 1 from public.comments a
    where a.created_at > c.created_at
      and a.autor_rolle <> 'kunde'
      and (a.story_id = c.story_id or a.ticket_id = c.ticket_id)
  )
  -- nur der jeweils letzte unbeantwortete Kommentar pro Objekt
  and not exists (
    select 1 from public.comments b
    where b.created_at > c.created_at
      and b.autor_rolle = 'kunde'
      and (b.story_id = c.story_id or b.ticket_id = c.ticket_id)
  );

revoke all on public.kontingent_stand, public.kunden_kennzahlen, public.offene_kundenkommentare
  from anon, authenticated;
grant select on public.kontingent_stand, public.kunden_kennzahlen, public.offene_kundenkommentare
  to authenticated;
