"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { fehlerText } from "@/lib/fehler";
import type { AktionErgebnis, TicketStatus } from "@/lib/types";
import { TICKET_PRIORITAET, TICKET_STATUS, TICKET_TYP } from "@/lib/workflow";
import { DATUM, ID, ersterFehler, optText, text } from "./hilfen";

const TicketBasis = z.object({
  titel: z.string().min(1, "Bitte einen Titel angeben.").max(200, "Der Titel ist zu lang."),
  beschreibung: z.string().max(20000),
  typ: z.enum(TICKET_TYP as [string, ...string[]], { message: "Bitte einen Typ wählen." }),
  prioritaet: z.enum(TICKET_PRIORITAET as [string, ...string[]], { message: "Bitte eine Priorität wählen." }),
});

export async function ticketAnlegen(customerId: string, _: AktionErgebnis, daten: FormData): Promise<AktionErgebnis> {
  const cid = ID.safeParse(customerId);
  const eingabe = TicketBasis.safeParse({
    titel: text(daten, "titel"),
    beschreibung: text(daten, "beschreibung"),
    typ: text(daten, "typ"),
    prioritaet: text(daten, "prioritaet") || "normal",
  });
  if (!cid.success) return { ok: false, fehler: "Ungültiger Kunde." };
  if (!eingabe.success) return { ok: false, fehler: ersterFehler(eingabe.error) };

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tickets")
    .insert({ customer_id: cid.data, ...eingabe.data })
    .select("id")
    .single();
  if (error) return { ok: false, fehler: fehlerText(error) };
  revalidatePath(`/k/${cid.data}`, "layout");
  redirect(`/k/${cid.data}/tickets/${data.id}`);
}

const TicketUpdate = TicketBasis.extend({
  status: z.enum(TICKET_STATUS as [string, ...string[]]),
  zustaendig_id: ID.nullable(),
  faellig_am: DATUM.nullable(),
});

/** Bearbeitung durch Berater/admin (RLS lässt Kunden hier nicht schreiben) */
export async function ticketAktualisieren(ticketId: string, _: AktionErgebnis, daten: FormData): Promise<AktionErgebnis> {
  const id = ID.safeParse(ticketId);
  const eingabe = TicketUpdate.safeParse({
    titel: text(daten, "titel"),
    beschreibung: text(daten, "beschreibung"),
    typ: text(daten, "typ"),
    prioritaet: text(daten, "prioritaet"),
    status: text(daten, "status"),
    zustaendig_id: optText(daten, "zustaendig_id"),
    faellig_am: optText(daten, "faellig_am"),
  });
  if (!id.success) return { ok: false, fehler: "Ungültiges Ticket." };
  if (!eingabe.success) return { ok: false, fehler: ersterFehler(eingabe.error) };

  const supabase = await createClient();
  const { data, error } = await supabase.from("tickets").update(eingabe.data).eq("id", id.data).select("customer_id");
  if (error) return { ok: false, fehler: fehlerText(error) };
  if (!data?.length) return { ok: false, fehler: "Sie dürfen dieses Ticket nicht bearbeiten." };
  revalidatePath(`/k/${data[0].customer_id}`, "layout");
  revalidatePath("/");
  return { ok: true, meldung: "Gespeichert." };
}

/** Statuswechsel per Drag & Drop auf dem Ticket-Board (nur Berater/admin) */
export async function ticketStatusSetzen(ticketId: string, status: TicketStatus): Promise<AktionErgebnis> {
  const id = ID.safeParse(ticketId);
  if (!id.success || !TICKET_STATUS.includes(status)) return { ok: false, fehler: "Ungültige Eingabe." };
  const supabase = await createClient();
  const { data, error } = await supabase.from("tickets").update({ status }).eq("id", id.data).select("customer_id");
  if (error) return { ok: false, fehler: fehlerText(error) };
  if (!data?.length) return { ok: false, fehler: "Nur Berater können den Ticket-Status ändern." };
  revalidatePath(`/k/${data[0].customer_id}`, "layout");
  return { ok: true };
}

export async function ticketInStoryUmwandeln(ticketId: string): Promise<AktionErgebnis> {
  const id = ID.safeParse(ticketId);
  if (!id.success) return { ok: false, fehler: "Ungültiges Ticket." };
  const supabase = await createClient();
  const { data: storyId, error } = await supabase.rpc("ticket_in_story_umwandeln", { p_ticket_id: id.data });
  if (error) return { ok: false, fehler: fehlerText(error) };
  const { data: story } = await supabase.from("stories").select("customer_id").eq("id", storyId).single();
  revalidatePath(`/k/${story!.customer_id}`, "layout");
  redirect(`/k/${story!.customer_id}/stories/${storyId}`);
}
