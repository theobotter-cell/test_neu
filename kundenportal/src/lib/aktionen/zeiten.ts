"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fehlerText } from "@/lib/fehler";
import { parseDezimal } from "@/lib/format";
import type { AktionErgebnis } from "@/lib/types";
import { DATUM, ID, ersterFehler, optText, text } from "./hilfen";

const ZeitDaten = z.object({
  customer_id: ID,
  datum: DATUM,
  dauer_stunden: z
    .number({ message: "Bitte eine Dauer in Stunden angeben (z. B. 1,5)." })
    .gt(0, "Die Dauer muss größer als 0 sein.")
    .max(24, "Die Dauer darf höchstens 24 Stunden betragen."),
  kategorie: z.enum(["beratung", "entwicklung"], { message: "Bitte eine Kategorie wählen." }),
  beschreibung: z.string().max(5000),
  abrechenbar: z.boolean(),
  story_id: ID.nullable(),
  ticket_id: ID.nullable(),
  bitrix_task_id: z.string().max(50).nullable(),
});

function lesen(daten: FormData) {
  return ZeitDaten.safeParse({
    customer_id: text(daten, "customer_id"),
    datum: text(daten, "datum"),
    dauer_stunden: parseDezimal(daten.get("dauer_stunden")) ?? undefined,
    kategorie: text(daten, "kategorie"),
    beschreibung: text(daten, "beschreibung"),
    abrechenbar: daten.get("abrechenbar") === "on" || daten.get("abrechenbar") === "true",
    story_id: optText(daten, "story_id"),
    ticket_id: optText(daten, "ticket_id"),
    bitrix_task_id: optText(daten, "bitrix_task_id"),
  });
}

/** Zeit erfassen (nur Berater des Kunden / admin – RLS erzwingt das) */
export async function zeitAnlegen(_: AktionErgebnis, daten: FormData): Promise<AktionErgebnis> {
  const eingabe = lesen(daten);
  if (!eingabe.success) return { ok: false, fehler: ersterFehler(eingabe.error) };
  const supabase = await createClient();
  const { error } = await supabase.from("time_entries").insert(eingabe.data);
  if (error) return { ok: false, fehler: fehlerText(error) };
  revalidatePath(`/k/${eingabe.data.customer_id}`, "layout");
  revalidatePath("/zeiterfassung");
  return { ok: true, meldung: "Zeit erfasst." };
}

export async function zeitAktualisieren(zeitId: string, _: AktionErgebnis, daten: FormData): Promise<AktionErgebnis> {
  const id = ID.safeParse(zeitId);
  const eingabe = lesen(daten);
  if (!id.success) return { ok: false, fehler: "Ungültiger Eintrag." };
  if (!eingabe.success) return { ok: false, fehler: ersterFehler(eingabe.error) };
  const supabase = await createClient();
  const { customer_id, ...aenderung } = eingabe.data;
  const { data, error } = await supabase.from("time_entries").update(aenderung).eq("id", id.data).select("id");
  if (error) return { ok: false, fehler: fehlerText(error) };
  if (!data?.length) return { ok: false, fehler: "Sie dürfen diesen Eintrag nicht bearbeiten." };
  revalidatePath(`/k/${customer_id}`, "layout");
  return { ok: true, meldung: "Gespeichert." };
}

export async function zeitLoeschen(zeitId: string): Promise<AktionErgebnis> {
  const id = ID.safeParse(zeitId);
  if (!id.success) return { ok: false, fehler: "Ungültiger Eintrag." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("time_entries").delete().eq("id", id.data).select("customer_id");
  if (error) return { ok: false, fehler: fehlerText(error) };
  if (!data?.length) return { ok: false, fehler: "Sie dürfen diesen Eintrag nicht löschen." };
  revalidatePath(`/k/${data[0].customer_id}`, "layout");
  return { ok: true, meldung: "Eintrag gelöscht." };
}
