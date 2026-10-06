"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient, type ServerClient } from "@/lib/supabase/server";
import { fehlerText } from "@/lib/fehler";
import { MAX_TRANSKRIPT_BYTES, TRANSKRIPT_BUCKET } from "@/lib/config";
import type { AktionErgebnis } from "@/lib/types";
import { DATUM, ID, ersterFehler, optText, text } from "./hilfen";

const TerminDaten = z.object({
  datum: DATUM,
  titel: z.string().min(1, "Bitte einen Titel angeben.").max(200),
  berater_id: ID.nullable(),
  transkript: z.string().max(1_000_000, "Das Transkript ist zu lang.").nullable(),
});

const ERLAUBTE_ENDUNGEN = /\.(txt|md|vtt|srt|pdf|docx?)$/i;

function dateinameBereinigen(name: string): string {
  const basis = name.normalize("NFKD").replace(/[^\w.\-]+/g, "_").replace(/_+/g, "_");
  return basis.slice(-100) || "transkript.txt";
}

/** Lädt die Datei unter <customer_id>/<meeting_id>/<name> hoch (RLS auf storage.objects) */
async function dateiHochladen(supabase: ServerClient, customerId: string, meetingId: string, datei: File) {
  if (datei.size > MAX_TRANSKRIPT_BYTES) return { fehler: "Die Datei ist größer als 20 MB." };
  if (!ERLAUBTE_ENDUNGEN.test(datei.name)) {
    return { fehler: "Erlaubt sind Text-, Untertitel-, PDF- und Word-Dateien (.txt, .md, .vtt, .srt, .pdf, .doc, .docx)." };
  }
  const pfad = `${customerId}/${meetingId}/${Date.now()}-${dateinameBereinigen(datei.name)}`;
  const { error } = await supabase.storage.from(TRANSKRIPT_BUCKET).upload(pfad, datei, {
    contentType: datei.type || "application/octet-stream",
    upsert: false,
  });
  if (error) return { fehler: "Die Datei konnte nicht hochgeladen werden." };
  return { pfad };
}

export async function terminAnlegen(customerId: string, _: AktionErgebnis, daten: FormData): Promise<AktionErgebnis> {
  const cid = ID.safeParse(customerId);
  const eingabe = TerminDaten.safeParse({
    datum: text(daten, "datum"),
    titel: text(daten, "titel"),
    berater_id: optText(daten, "berater_id"),
    transkript: optText(daten, "transkript"),
  });
  if (!cid.success) return { ok: false, fehler: "Ungültiger Kunde." };
  if (!eingabe.success) return { ok: false, fehler: ersterFehler(eingabe.error) };
  const datei = daten.get("datei");
  const hatDatei = datei instanceof File && datei.size > 0;

  const supabase = await createClient();
  const { data: termin, error } = await supabase
    .from("meetings")
    .insert({ customer_id: cid.data, ...eingabe.data })
    .select("id")
    .single();
  if (error) return { ok: false, fehler: fehlerText(error) };

  if (hatDatei) {
    const r = await dateiHochladen(supabase, cid.data, termin.id, datei);
    if ("fehler" in r) {
      return { ok: false, fehler: `Termin wurde angelegt, aber: ${r.fehler}` };
    }
    await supabase.from("meetings").update({ transkript_datei: r.pfad }).eq("id", termin.id);
  }
  revalidatePath(`/k/${cid.data}`, "layout");
  redirect(`/k/${cid.data}/termine/${termin.id}`);
}

export async function terminAktualisieren(terminId: string, _: AktionErgebnis, daten: FormData): Promise<AktionErgebnis> {
  const id = ID.safeParse(terminId);
  const eingabe = TerminDaten.safeParse({
    datum: text(daten, "datum"),
    titel: text(daten, "titel"),
    berater_id: optText(daten, "berater_id"),
    transkript: optText(daten, "transkript"),
  });
  if (!id.success) return { ok: false, fehler: "Ungültiger Termin." };
  if (!eingabe.success) return { ok: false, fehler: ersterFehler(eingabe.error) };

  const supabase = await createClient();
  const { data: alt } = await supabase.from("meetings").select("customer_id, transkript_datei").eq("id", id.data).maybeSingle();
  if (!alt) return { ok: false, fehler: "Termin nicht gefunden." };

  const aenderung: Record<string, unknown> = { ...eingabe.data };
  const datei = daten.get("datei");
  if (datei instanceof File && datei.size > 0) {
    const r = await dateiHochladen(supabase, alt.customer_id, id.data, datei);
    if ("fehler" in r) return { ok: false, fehler: r.fehler! };
    aenderung.transkript_datei = r.pfad;
  }
  const { data, error } = await supabase.from("meetings").update(aenderung).eq("id", id.data).select("id");
  if (error) return { ok: false, fehler: fehlerText(error) };
  if (!data?.length) return { ok: false, fehler: "Keine Berechtigung." };
  if (aenderung.transkript_datei && alt.transkript_datei) {
    await supabase.storage.from(TRANSKRIPT_BUCKET).remove([alt.transkript_datei]);
  }
  revalidatePath(`/k/${alt.customer_id}`, "layout");
  return { ok: true, meldung: "Gespeichert." };
}

export async function terminLoeschen(terminId: string): Promise<AktionErgebnis> {
  const id = ID.safeParse(terminId);
  if (!id.success) return { ok: false, fehler: "Ungültiger Termin." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("meetings").delete().eq("id", id.data).select("customer_id, transkript_datei");
  if (error) return { ok: false, fehler: fehlerText(error) };
  if (!data?.length) return { ok: false, fehler: "Keine Berechtigung." };
  if (data[0].transkript_datei) {
    await supabase.storage.from(TRANSKRIPT_BUCKET).remove([data[0].transkript_datei]);
  }
  revalidatePath(`/k/${data[0].customer_id}`, "layout");
  redirect(`/k/${data[0].customer_id}/termine`);
}
