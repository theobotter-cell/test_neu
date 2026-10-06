"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fehlerText } from "@/lib/fehler";
import type { AktionErgebnis } from "@/lib/types";
import { optText, text } from "./hilfen";

export async function profilSpeichern(_: AktionErgebnis, daten: FormData): Promise<AktionErgebnis> {
  const name = text(daten, "name");
  const buchungslink = optText(daten, "buchungslink");
  if (!name) return { ok: false, fehler: "Bitte einen Namen angeben." };
  if (buchungslink && !/^https:\/\/\S+$/i.test(buchungslink)) {
    return { ok: false, fehler: "Der Buchungslink muss mit https:// beginnen." };
  }
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, fehler: "Nicht angemeldet." };
  const aenderung: Record<string, string | null> = { name };
  if (daten.has("buchungslink")) aenderung.buchungslink = buchungslink;
  const { error } = await supabase.from("profiles").update(aenderung).eq("id", user.id);
  if (error) return { ok: false, fehler: fehlerText(error) };
  revalidatePath("/", "layout");
  return { ok: true, meldung: "Profil gespeichert." };
}

export async function passwortAendern(_: AktionErgebnis, daten: FormData): Promise<AktionErgebnis> {
  const passwort = String(daten.get("passwort") ?? "");
  if (passwort.length < 10 || !/[a-zA-Z]/.test(passwort) || !/\d/.test(passwort)) {
    return { ok: false, fehler: "Mindestens 10 Zeichen, Buchstaben und Ziffern." };
  }
  if (passwort !== String(daten.get("wiederholung") ?? "")) return { ok: false, fehler: "Die Passwörter stimmen nicht überein." };
  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: passwort });
  if (error) return { ok: false, fehler: "Das Passwort konnte nicht geändert werden." };
  return { ok: true, meldung: "Passwort geändert." };
}
