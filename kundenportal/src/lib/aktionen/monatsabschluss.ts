"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fehlerText } from "@/lib/fehler";
import type { AktionErgebnis } from "@/lib/types";
import { ID, MONAT, text } from "./hilfen";

export async function monatAbschliessen(customerId: string, monat: string): Promise<AktionErgebnis> {
  const cid = ID.safeParse(customerId);
  const m = MONAT.safeParse(monat);
  if (!cid.success || !m.success) return { ok: false, fehler: "Ungültige Eingabe." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("monat_abschliessen", { p_customer_id: cid.data, p_monat: m.data });
  if (error) return { ok: false, fehler: fehlerText(error) };
  revalidatePath(`/k/${cid.data}`, "layout");
  revalidatePath("/");
  return { ok: true, meldung: "Monat abgeschlossen. Die Zeiten dieses Monats sind jetzt gesperrt." };
}

export async function monatWiedereroeffnen(
  customerId: string,
  monat: string,
  _: AktionErgebnis,
  daten: FormData,
): Promise<AktionErgebnis> {
  const cid = ID.safeParse(customerId);
  const m = MONAT.safeParse(monat);
  const grund = text(daten, "grund");
  if (!cid.success || !m.success) return { ok: false, fehler: "Ungültige Eingabe." };
  if (!grund) return { ok: false, fehler: "Bitte einen Grund angeben (wird protokolliert)." };
  const supabase = await createClient();
  const { error } = await supabase.rpc("monat_wiedereroeffnen", { p_customer_id: cid.data, p_monat: m.data, p_grund: grund });
  if (error) return { ok: false, fehler: fehlerText(error) };
  revalidatePath(`/k/${cid.data}`, "layout");
  return { ok: true, meldung: "Monat wieder geöffnet." };
}
