"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { AktionErgebnis } from "@/lib/types";

export async function passwortSetzen(_: AktionErgebnis, daten: FormData): Promise<AktionErgebnis> {
  const passwort = String(daten.get("passwort") ?? "");
  const wiederholung = String(daten.get("wiederholung") ?? "");
  if (passwort.length < 10 || !/[a-zA-Z]/.test(passwort) || !/\d/.test(passwort)) {
    return { ok: false, fehler: "Das Passwort muss mindestens 10 Zeichen lang sein und Buchstaben sowie Ziffern enthalten." };
  }
  if (passwort !== wiederholung) return { ok: false, fehler: "Die Passwörter stimmen nicht überein." };

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({ password: passwort });
  if (error) return { ok: false, fehler: "Das Passwort konnte nicht gespeichert werden. Bitte versuchen Sie es erneut." };
  redirect("/");
}
