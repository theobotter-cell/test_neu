"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fehlerText } from "@/lib/fehler";
import { parseDezimal } from "@/lib/format";
import type { AktionErgebnis } from "@/lib/types";
import { DATUM, ID, ersterFehler, optText, text } from "./hilfen";

const KontingentDaten = z.object({
  leistung: z.string().min(1, "Bitte die Leistung angeben.").max(200),
  gebucht_am: DATUM,
  stunden: z.number({ message: "Bitte die Stunden angeben." }).min(0, "Stunden dürfen nicht negativ sein.").max(100000),
  betrag: z.number().min(0, "Der Betrag darf nicht negativ sein.").nullable(),
  bitrix_deal_id: z.string().max(50).nullable(),
});

function lesen(daten: FormData) {
  return KontingentDaten.safeParse({
    leistung: text(daten, "leistung"),
    gebucht_am: text(daten, "gebucht_am"),
    stunden: parseDezimal(daten.get("stunden")) ?? undefined,
    betrag: parseDezimal(daten.get("betrag")),
    bitrix_deal_id: optText(daten, "bitrix_deal_id"),
  });
}

export async function kontingentAnlegen(customerId: string, _: AktionErgebnis, daten: FormData): Promise<AktionErgebnis> {
  const cid = ID.safeParse(customerId);
  const eingabe = lesen(daten);
  if (!cid.success) return { ok: false, fehler: "Ungültiger Kunde." };
  if (!eingabe.success) return { ok: false, fehler: ersterFehler(eingabe.error) };
  const supabase = await createClient();
  const { error } = await supabase.from("kontingente").insert({ customer_id: cid.data, ...eingabe.data });
  if (error) return { ok: false, fehler: fehlerText(error) };
  revalidatePath(`/k/${cid.data}`, "layout");
  return { ok: true, meldung: "Leistung gespeichert." };
}

export async function kontingentAktualisieren(id: string, _: AktionErgebnis, daten: FormData): Promise<AktionErgebnis> {
  const kid = ID.safeParse(id);
  const eingabe = lesen(daten);
  if (!kid.success) return { ok: false, fehler: "Ungültiger Eintrag." };
  if (!eingabe.success) return { ok: false, fehler: ersterFehler(eingabe.error) };
  const supabase = await createClient();
  const { data, error } = await supabase.from("kontingente").update(eingabe.data).eq("id", kid.data).select("customer_id");
  if (error) return { ok: false, fehler: fehlerText(error) };
  if (!data?.length) return { ok: false, fehler: "Keine Berechtigung." };
  revalidatePath(`/k/${data[0].customer_id}`, "layout");
  return { ok: true, meldung: "Gespeichert." };
}

export async function kontingentLoeschen(id: string): Promise<AktionErgebnis> {
  const kid = ID.safeParse(id);
  if (!kid.success) return { ok: false, fehler: "Ungültiger Eintrag." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("kontingente").delete().eq("id", kid.data).select("customer_id");
  if (error) return { ok: false, fehler: fehlerText(error) };
  if (!data?.length) return { ok: false, fehler: "Keine Berechtigung." };
  revalidatePath(`/k/${data[0].customer_id}`, "layout");
  return { ok: true, meldung: "Leistung gelöscht." };
}
