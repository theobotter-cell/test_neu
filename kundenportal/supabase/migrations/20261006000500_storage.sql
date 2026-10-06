-- =============================================================================
-- Linxys Kundenportal – Storage für Transkript-Dateien
-- =============================================================================
-- Privater Bucket. Pfadschema: <customer_id>/<meeting_id>/<dateiname>
-- Gleiche Zugriffsregeln wie public.meetings: lesen = darf_lesen,
-- schreiben/löschen = darf_bearbeiten (admin, zugeordnete Berater).
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'transkripte', 'transkripte', false, 20971520,
  array[
    'text/plain', 'text/markdown', 'text/vtt', 'application/x-subrip',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/msword'
  ]
)
on conflict (id) do update
  set public = false,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy transkripte_select on storage.objects for select to authenticated
  using (bucket_id = 'transkripte' and app.darf_lesen(app.pfad_kunde(name)));

create policy transkripte_insert on storage.objects for insert to authenticated
  with check (
    bucket_id = 'transkripte'
    and app.darf_bearbeiten(app.pfad_kunde(name))
    -- Die Datei muss zu einem Termin desselben Kunden gehören
    and exists (
      select 1 from public.meetings m
      where m.customer_id = app.pfad_kunde(name)
        and m.id::text = split_part(name, '/', 2)
    )
  );

create policy transkripte_update on storage.objects for update to authenticated
  using (bucket_id = 'transkripte' and app.darf_bearbeiten(app.pfad_kunde(name)))
  with check (bucket_id = 'transkripte' and app.darf_bearbeiten(app.pfad_kunde(name)));

create policy transkripte_delete on storage.objects for delete to authenticated
  using (bucket_id = 'transkripte' and app.darf_bearbeiten(app.pfad_kunde(name)));
