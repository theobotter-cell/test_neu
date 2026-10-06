import "server-only";
import type { ServerClient } from "@/lib/supabase/server";
import type { ZeitKategorie } from "@/lib/types";
import type { ZeitZeile } from "@/components/zeiten-tabelle";

export type ZeitFilter = { von?: string; bis?: string; kategorie?: ZeitKategorie };

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function filterLesen(sp: Record<string, string | undefined>): ZeitFilter {
  return {
    von: sp.von && ISO.test(sp.von) ? sp.von : undefined,
    bis: sp.bis && ISO.test(sp.bis) ? sp.bis : undefined,
    kategorie: sp.kategorie === "beratung" || sp.kategorie === "entwicklung" ? sp.kategorie : undefined,
  };
}

/** Zeiten eines Kunden inkl. Titel verknüpfter Stories/Tickets (RLS-geschützt) */
export async function ladeZeiten(supabase: ServerClient, customerId: string, f: ZeitFilter): Promise<ZeitZeile[]> {
  let q = supabase
    .from("time_entries")
    .select("*, stories(titel), tickets(titel)")
    .eq("customer_id", customerId)
    .order("datum", { ascending: false })
    .order("created_at", { ascending: false });
  if (f.von) q = q.gte("datum", f.von);
  if (f.bis) q = q.lte("datum", f.bis);
  if (f.kategorie) q = q.eq("kategorie", f.kategorie);
  const { data } = await q;
  return (data ?? []).map((z) => {
    const { stories, tickets, ...rest } = z as ZeitZeile & { stories: { titel: string } | null; tickets: { titel: string } | null };
    return { ...rest, story_titel: stories?.titel ?? null, ticket_titel: tickets?.titel ?? null };
  });
}
