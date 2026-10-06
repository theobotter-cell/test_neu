"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { sicheresZiel } from "@/lib/weiterleitung";
import type { AktionErgebnis } from "@/lib/types";

export async function anmelden(_: AktionErgebnis, daten: FormData): Promise<AktionErgebnis> {
  const email = String(daten.get("email") ?? "").trim();
  const passwort = String(daten.get("passwort") ?? "");
  if (!email || !passwort) return { ok: false, fehler: "Bitte E-Mail und Passwort eingeben." };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: passwort });
  if (error || !data.user) return { ok: false, fehler: "E-Mail oder Passwort ist falsch." };

  const { data: profil } = await supabase.from("profiles").select("aktiv").eq("id", data.user.id).maybeSingle();
  if (!profil?.aktiv) {
    await supabase.auth.signOut();
    return { ok: false, fehler: "Ihr Zugang ist deaktiviert. Bitte wenden Sie sich an Linxys." };
  }
  redirect(sicheresZiel(String(daten.get("weiter") ?? "")));
}
