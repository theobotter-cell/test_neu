"use server";

import { createClient } from "@/lib/supabase/server";
import { appUrl } from "@/lib/config";
import type { AktionErgebnis } from "@/lib/types";

export async function passwortZuruecksetzen(_: AktionErgebnis, daten: FormData): Promise<AktionErgebnis> {
  const email = String(daten.get("email") ?? "").trim();
  if (!email) return { ok: false, fehler: "Bitte E-Mail eingeben." };
  const supabase = await createClient();
  await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${appUrl()}/auth/confirm?weiter=/passwort-setzen`,
  });
  // Immer gleiche Antwort – verrät nicht, ob die Adresse existiert
  return { ok: true, meldung: "Falls ein Zugang zu dieser Adresse existiert, haben wir Ihnen eine E-Mail gesendet." };
}
