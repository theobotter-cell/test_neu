"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { fehlerText } from "@/lib/fehler";
import type { AktionErgebnis } from "@/lib/types";
import { ID, text } from "./hilfen";

/** Kommentar an Story oder Ticket. Autor und Rolle setzt die Datenbank. */
export async function kommentarAnlegen(
  bezug: { customerId: string; storyId?: string; ticketId?: string },
  _: AktionErgebnis,
  daten: FormData,
): Promise<AktionErgebnis> {
  const inhalt = text(daten, "text");
  if (!inhalt) return { ok: false, fehler: "Bitte einen Kommentar eingeben." };
  if (inhalt.length > 10000) return { ok: false, fehler: "Der Kommentar ist zu lang." };
  const cid = ID.safeParse(bezug.customerId);
  const ziel = ID.safeParse(bezug.storyId ?? bezug.ticketId);
  if (!cid.success || !ziel.success) return { ok: false, fehler: "Ungültiger Bezug." };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase.from("comments").insert({
    customer_id: cid.data,
    story_id: bezug.storyId ? ziel.data : null,
    ticket_id: bezug.ticketId ? ziel.data : null,
    autor_id: user?.id,
    text: inhalt,
  });
  if (error) return { ok: false, fehler: fehlerText(error) };
  revalidatePath(`/k/${cid.data}`, "layout");
  return { ok: true };
}
