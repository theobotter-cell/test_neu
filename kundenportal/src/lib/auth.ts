import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { Kunde, Profil, Rolle } from "@/lib/types";

/**
 * Angemeldeter Nutzer + Profil (pro Request gecacht). Die Rolle stammt
 * ausschließlich aus der Tabelle profiles (RLS-geschützt), nie aus Metadaten.
 */
export const ladeSitzung = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: profil } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle<Profil>();
  return { supabase, user, profil: profil ?? null };
});

export async function sitzungErforderlich() {
  const s = await ladeSitzung();
  if (!s) redirect("/login");
  if (!s.profil || !s.profil.aktiv) redirect("/auth/abmelden?grund=deaktiviert");
  return { supabase: s.supabase, user: s.user, profil: s.profil };
}

export async function rolleErforderlich(...rollen: Rolle[]) {
  const s = await sitzungErforderlich();
  if (!rollen.includes(s.profil.rolle)) notFound();
  return s;
}

export function istIntern(rolle: Rolle) {
  return rolle === "admin" || rolle === "berater" || rolle === "customer_success";
}

/**
 * Lädt einen Kunden im Kontext des Nutzers. RLS liefert nur zugängliche
 * Kunden – alles andere ist für den Nutzer "nicht gefunden".
 */
export const ladeKundenKontext = cache(async (customerId: string) => {
  const s = await sitzungErforderlich();
  if (!/^[0-9a-f-]{36}$/i.test(customerId)) notFound();
  const { data: kunde } = await s.supabase.from("customers").select("*").eq("id", customerId).maybeSingle<Kunde>();
  if (!kunde) notFound();

  let darfBearbeiten = s.profil.rolle === "admin";
  if (s.profil.rolle === "berater") {
    if (kunde.hauptberater_id === s.profil.id) {
      darfBearbeiten = true;
    } else {
      const { count } = await s.supabase
        .from("customer_consultants")
        .select("berater_id", { count: "exact", head: true })
        .eq("customer_id", customerId)
        .eq("berater_id", s.profil.id);
      darfBearbeiten = (count ?? 0) > 0;
    }
  }
  const istKunde = s.profil.rolle === "kunde" && kunde.kunde_user_id === s.profil.id;
  return {
    ...s,
    kunde,
    /** admin oder zugeordneter Berater: interne Bearbeitung */
    darfBearbeiten,
    /** eigener Kunden-Login */
    istKunde,
    /** darf Stories/Tickets anlegen und kommentieren */
    darfMitwirken: darfBearbeiten || istKunde,
    intern: istIntern(s.profil.rolle),
  };
});

export type KundenKontext = Awaited<ReturnType<typeof ladeKundenKontext>>;
