"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fehlerText } from "@/lib/fehler";
import { parseDezimal } from "@/lib/format";
import type { AktionErgebnis, StoryStatus } from "@/lib/types";
import { STORY_STATUS } from "@/lib/workflow";
import { ID, ersterFehler, text } from "./hilfen";

const StoryDaten = z.object({
  titel: z.string().min(1, "Bitte einen Titel angeben.").max(200, "Der Titel ist zu lang."),
  beschreibung: z.string().max(20000),
  akzeptanzkriterien: z.string().max(20000),
});

export async function storyAnlegen(customerId: string, _: AktionErgebnis, daten: FormData): Promise<AktionErgebnis> {
  const cid = ID.safeParse(customerId);
  const eingabe = StoryDaten.safeParse({
    titel: text(daten, "titel"),
    beschreibung: text(daten, "beschreibung"),
    akzeptanzkriterien: text(daten, "akzeptanzkriterien"),
  });
  if (!cid.success) return { ok: false, fehler: "Ungültiger Kunde." };
  if (!eingabe.success) return { ok: false, fehler: ersterFehler(eingabe.error) };

  const supabase = await createClient();
  const { data: letzte } = await supabase
    .from("stories")
    .select("position")
    .eq("customer_id", cid.data)
    .eq("status", "entwurf")
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();

  const { data, error } = await supabase
    .from("stories")
    .insert({ customer_id: cid.data, ...eingabe.data, position: (letzte?.position ?? 0) + 1 })
    .select("id")
    .single();
  if (error) return { ok: false, fehler: fehlerText(error) };
  revalidatePath(`/k/${cid.data}`, "layout");
  redirect(`/k/${cid.data}/stories/${data.id}`);
}

export async function storyBearbeiten(storyId: string, _: AktionErgebnis, daten: FormData): Promise<AktionErgebnis> {
  const id = ID.safeParse(storyId);
  const eingabe = StoryDaten.safeParse({
    titel: text(daten, "titel"),
    beschreibung: text(daten, "beschreibung"),
    akzeptanzkriterien: text(daten, "akzeptanzkriterien"),
  });
  if (!id.success) return { ok: false, fehler: "Ungültige Story." };
  if (!eingabe.success) return { ok: false, fehler: ersterFehler(eingabe.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.from("stories").update(eingabe.data).eq("id", id.data).select("customer_id");
  if (error) return { ok: false, fehler: fehlerText(error) };
  if (!data?.length) return { ok: false, fehler: "Diese Story kann von Ihnen nicht (mehr) bearbeitet werden." };
  revalidatePath(`/k/${data[0].customer_id}`, "layout");
  return { ok: true, meldung: "Gespeichert." };
}

/**
 * Statuswechsel ausschließlich über die Datenbankfunktion story_transition(),
 * die Rolle, Übergang und Pflichtangaben prüft und den Verlauf schreibt.
 */
export async function storyUebergang(eingabe: {
  storyId: string;
  nach: StoryStatus;
  kommentar?: string | null;
  schaetzung?: number | null;
}): Promise<AktionErgebnis> {
  const id = ID.safeParse(eingabe.storyId);
  if (!id.success || !STORY_STATUS.includes(eingabe.nach)) return { ok: false, fehler: "Ungültige Eingabe." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("story_transition", {
    p_story_id: id.data,
    p_nach_status: eingabe.nach,
    p_kommentar: eingabe.kommentar?.trim() || null,
    p_schaetzung: eingabe.schaetzung ?? null,
  });
  if (error) return { ok: false, fehler: fehlerText(error) };
  revalidatePath(`/k/${(data as { customer_id: string }).customer_id}`, "layout");
  revalidatePath("/");
  return { ok: true, meldung: "Status geändert." };
}

/** Formular-Variante (Detailansicht, Dashboard-Buttons) */
export async function storyUebergangFormular(
  storyId: string,
  nach: StoryStatus,
  _: AktionErgebnis,
  daten: FormData,
): Promise<AktionErgebnis> {
  const schaetzungRoh = daten.get("schaetzung");
  const schaetzung = schaetzungRoh === null ? null : parseDezimal(schaetzungRoh);
  if (schaetzungRoh !== null && (schaetzung === null || schaetzung <= 0)) {
    return { ok: false, fehler: "Bitte eine gültige Schätzung in Stunden angeben (z. B. 4,5)." };
  }
  return storyUebergang({ storyId, nach, kommentar: text(daten, "kommentar"), schaetzung });
}

export async function storyLoeschen(storyId: string): Promise<AktionErgebnis> {
  const id = ID.safeParse(storyId);
  if (!id.success) return { ok: false, fehler: "Ungültige Story." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("stories").delete().eq("id", id.data).select("customer_id");
  if (error) return { ok: false, fehler: fehlerText(error) };
  if (!data?.length) return { ok: false, fehler: "Diese Story kann von Ihnen nicht gelöscht werden." };
  revalidatePath(`/k/${data[0].customer_id}`, "layout");
  redirect(`/k/${data[0].customer_id}/board`);
}
