import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { appUrl } from "@/lib/config";
import { plusTage } from "@/lib/format";
import { TICKET_STATUS_LABEL } from "@/lib/workflow";
import { storyStatusText, type BerichtDaten } from "@/lib/bericht";
import type { StoryStatus } from "@/lib/types";

/** Lädt alle Daten eines Kundenberichts (Service-Role, daher strikt per customer_id gefiltert) */
export async function berichtDatenLaden(
  admin: SupabaseClient,
  kunde: { id: string; firmenname: string },
  empfaengerName: string,
  von: string,
  bis: string,
): Promise<BerichtDaten> {
  const bisExklusiv = plusTage(bis, 1);
  const [zeiten, stand, tickets, abnahmen, stories, wartendeTickets, termine] = await Promise.all([
    admin.from("time_entries").select("dauer_stunden, kategorie").eq("customer_id", kunde.id).gte("datum", von).lte("datum", bis),
    admin.from("kontingent_stand").select("gesamt, verbraucht, rest").eq("customer_id", kunde.id).maybeSingle(),
    admin.from("tickets").select("titel").eq("customer_id", kunde.id).eq("status", "erledigt").gte("status_seit", von).lt("status_seit", bisExklusiv),
    admin
      .from("approvals")
      .select("stories(titel)")
      .eq("customer_id", kunde.id)
      .eq("aktion", "abgenommen")
      .gte("created_at", von)
      .lt("created_at", bisExklusiv),
    admin.from("stories").select("titel, status").eq("customer_id", kunde.id).in("status", ["geschaetzt", "zur_abnahme"]),
    admin.from("tickets").select("titel, status").eq("customer_id", kunde.id).eq("status", "wartet_auf_kunde"),
    admin.from("meetings").select("datum, titel").eq("customer_id", kunde.id).gte("datum", von).lte("datum", bis).order("datum"),
  ]);

  const summe = (k: string) =>
    Math.round((zeiten.data ?? []).filter((z) => z.kategorie === k).reduce((s, z) => s + Number(z.dauer_stunden), 0) * 100) / 100;

  return {
    firmenname: kunde.firmenname,
    empfaengerName,
    von,
    bis,
    stunden: { beratung: summe("beratung"), entwicklung: summe("entwicklung") },
    kontingent: {
      gesamt: Number(stand.data?.gesamt ?? 0),
      verbraucht: Number(stand.data?.verbraucht ?? 0),
      rest: Number(stand.data?.rest ?? 0),
    },
    erledigteTickets: (tickets.data ?? []).map((t) => ({ titel: t.titel })),
    abgenommeneStories: (abnahmen.data ?? []).map((a) => ({ titel: (a.stories as unknown as { titel: string } | null)?.titel ?? "Story" })),
    offeneFreigaben: [
      ...(stories.data ?? []).map((s) => ({ titel: s.titel, art: "story" as const, status: storyStatusText(s.status as StoryStatus) })),
      ...(wartendeTickets.data ?? []).map((t) => ({ titel: t.titel, art: "ticket" as const, status: TICKET_STATUS_LABEL.wartet_auf_kunde })),
    ],
    termine: (termine.data ?? []).map((m) => ({ datum: m.datum, titel: m.titel })),
    portalLink: `${appUrl()}/k/${kunde.id}`,
  };
}
