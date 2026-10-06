import "server-only";
import type { ServerClient } from "@/lib/supabase/server";
import type { KontingentStand, Profil, ZeitKategorie } from "@/lib/types";
import { AKTION_LABEL, KATEGORIE_LABEL } from "@/lib/workflow";
import { formatDatum, formatStunden } from "@/lib/format";

/** Namen von Profilen (soweit per RLS sichtbar) */
export async function ladeNamen(supabase: ServerClient, ids: (string | null | undefined)[]): Promise<Map<string, string>> {
  const eindeutig = [...new Set(ids.filter((x): x is string => Boolean(x)))];
  if (!eindeutig.length) return new Map();
  const { data } = await supabase.from("profiles").select("id, name").in("id", eindeutig);
  return new Map((data ?? []).map((p) => [p.id as string, p.name as string]));
}

export async function ladeKontingentStand(supabase: ServerClient, customerId: string): Promise<KontingentStand> {
  const { data } = await supabase.from("kontingent_stand").select("*").eq("customer_id", customerId).maybeSingle<KontingentStand>();
  return (
    data ?? { customer_id: customerId, gesamt: "0", verbraucht: "0", verbraucht_beratung: "0", verbraucht_entwicklung: "0", rest: "0" }
  );
}

/** Aktive Berater und admins (für Auswahllisten) */
export async function ladeBerater(supabase: ServerClient): Promise<Pick<Profil, "id" | "name" | "rolle">[]> {
  const { data } = await supabase
    .from("profiles")
    .select("id, name, rolle")
    .in("rolle", ["berater", "admin"])
    .eq("aktiv", true)
    .order("name");
  return (data ?? []) as Pick<Profil, "id" | "name" | "rolle">[];
}

export type Aktivitaet = { zeit: string; text: string; link?: string };

/** Letzte Aktivitäten eines Kunden aus Verlauf, Kommentaren, Tickets, Zeiten und Terminen */
export async function ladeAktivitaeten(supabase: ServerClient, customerId: string, anzahl = 10): Promise<Aktivitaet[]> {
  const basis = `/k/${customerId}`;
  const [approvals, kommentare, tickets, zeiten, termine] = await Promise.all([
    supabase.from("approvals").select("created_at, aktion, story_id, stories(titel)").eq("customer_id", customerId).order("created_at", { ascending: false }).limit(anzahl),
    supabase.from("comments").select("created_at, story_id, ticket_id, autor_rolle").eq("customer_id", customerId).order("created_at", { ascending: false }).limit(anzahl),
    supabase.from("tickets").select("created_at, id, titel").eq("customer_id", customerId).order("created_at", { ascending: false }).limit(anzahl),
    supabase.from("time_entries").select("created_at, datum, dauer_stunden, kategorie").eq("customer_id", customerId).order("created_at", { ascending: false }).limit(anzahl),
    supabase.from("meetings").select("created_at, id, titel").eq("customer_id", customerId).order("created_at", { ascending: false }).limit(anzahl),
  ]);

  const liste: Aktivitaet[] = [];
  for (const a of approvals.data ?? []) {
    const titel = (a.stories as unknown as { titel: string } | null)?.titel ?? "Story";
    liste.push({ zeit: a.created_at, text: `Story „${titel}“ ${AKTION_LABEL[a.aktion] ?? a.aktion}`, link: `${basis}/stories/${a.story_id}` });
  }
  for (const k of kommentare.data ?? []) {
    liste.push({
      zeit: k.created_at,
      text: k.autor_rolle === "kunde" ? "Neuer Kommentar des Kunden" : "Neuer Kommentar von Linxys",
      link: k.story_id ? `${basis}/stories/${k.story_id}` : `${basis}/tickets/${k.ticket_id}`,
    });
  }
  for (const t of tickets.data ?? []) {
    liste.push({ zeit: t.created_at, text: `Ticket „${t.titel}“ angelegt`, link: `${basis}/tickets/${t.id}` });
  }
  for (const z of zeiten.data ?? []) {
    liste.push({
      zeit: z.created_at,
      text: `${formatStunden(z.dauer_stunden)} ${KATEGORIE_LABEL[z.kategorie as ZeitKategorie]} am ${formatDatum(z.datum)} erfasst`,
      link: `${basis}/zeiten`,
    });
  }
  for (const m of termine.data ?? []) {
    liste.push({ zeit: m.created_at, text: `Termin „${m.titel}“ dokumentiert`, link: `${basis}/termine/${m.id}` });
  }
  return liste.sort((a, b) => b.zeit.localeCompare(a.zeit)).slice(0, anzahl);
}
