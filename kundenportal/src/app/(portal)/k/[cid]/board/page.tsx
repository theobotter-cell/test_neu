import Link from "next/link";
import type { Metadata } from "next";
import { ladeKundenKontext } from "@/lib/auth";
import { Seitenkopf } from "@/components/seitenkopf";
import { buttonVariants } from "@/components/ui/button";
import { StoryBoard } from "@/components/board/story-board";
import { TicketBoard } from "@/components/board/ticket-board";
import { TICKET_PRIORITAET, TICKET_PRIORITAET_LABEL, TICKET_TYP, TICKET_TYP_LABEL } from "@/lib/workflow";
import { cn } from "@/lib/utils";
import type { Story, Ticket, TicketPrioritaet, TicketTyp } from "@/lib/types";

export const metadata: Metadata = { title: "Board" };

export default async function BoardSeite({
  params,
  searchParams,
}: {
  params: Promise<{ cid: string }>;
  searchParams: Promise<{ tab?: string; typ?: string; prioritaet?: string; erledigt?: string }>;
}) {
  const { cid } = await params;
  const sp = await searchParams;
  const ctx = await ladeKundenKontext(cid);
  const basis = `/k/${cid}`;
  const tab = sp.tab === "tickets" ? "tickets" : "stories";
  const typ = TICKET_TYP.find((t) => t === sp.typ);
  const prioritaet = TICKET_PRIORITAET.find((p) => p === sp.prioritaet);

  const link = (aenderung: Record<string, string | undefined>) => {
    const p = new URLSearchParams();
    const werte = { tab, typ, prioritaet, ...aenderung };
    Object.entries(werte).forEach(([k, v]) => v && p.set(k, v));
    return `${basis}/board?${p.toString()}`;
  };

  let inhalt: React.ReactNode;
  if (tab === "stories") {
    const { data } = await ctx.supabase
      .from("stories")
      .select("id, titel, status, schaetzung_stunden, ticket_id, position, created_at")
      .eq("customer_id", cid)
      .order("position")
      .order("created_at");
    inhalt = (
      <StoryBoard
        stories={(data ?? []) as Story[]}
        rolle={ctx.profil.rolle}
        darfBearbeiten={ctx.darfBearbeiten}
        basis={basis}
      />
    );
  } else {
    let abfrage = ctx.supabase
      .from("tickets")
      .select("id, titel, status, typ, prioritaet, faellig_am, story_id, created_at")
      .eq("customer_id", cid)
      .order("created_at", { ascending: false });
    if (typ) abfrage = abfrage.eq("typ", typ);
    if (prioritaet) abfrage = abfrage.eq("prioritaet", prioritaet);
    const { data } = await abfrage;
    inhalt = (
      <>
        <div className="mb-4 flex flex-wrap items-center gap-2 text-sm">
          <span className="text-muted-foreground">Typ:</span>
          <Filter href={link({ typ: undefined })} aktiv={!typ}>Alle</Filter>
          {TICKET_TYP.map((t: TicketTyp) => (
            <Filter key={t} href={link({ typ: t })} aktiv={typ === t}>
              {TICKET_TYP_LABEL[t]}
            </Filter>
          ))}
          <span className="ml-4 text-muted-foreground">Priorität:</span>
          <Filter href={link({ prioritaet: undefined })} aktiv={!prioritaet}>Alle</Filter>
          {TICKET_PRIORITAET.map((p: TicketPrioritaet) => (
            <Filter key={p} href={link({ prioritaet: p })} aktiv={prioritaet === p}>
              {TICKET_PRIORITAET_LABEL[p]}
            </Filter>
          ))}
        </div>
        <TicketBoard tickets={(data ?? []) as Ticket[]} darfBearbeiten={ctx.darfBearbeiten} basis={basis} />
      </>
    );
  }

  return (
    <>
      <Seitenkopf
        titel="Board"
        beschreibung={
          tab === "stories"
            ? "Karten lassen sich nur entlang der für Ihre Rolle erlaubten Schritte verschieben."
            : ctx.darfBearbeiten
              ? "Status per Drag & Drop ändern."
              : "Übersicht Ihrer Tickets."
        }
        aktionen={
          ctx.darfMitwirken && (
            <Link href={tab === "stories" ? `${basis}/stories/neu` : `${basis}/tickets/neu`} className={buttonVariants()}>
              {tab === "stories" ? "Neue Story" : "Neues Ticket"}
            </Link>
          )
        }
      />
      <div className="mb-4 inline-flex rounded-lg border bg-muted p-1" role="tablist">
        <Link href={`${basis}/board?tab=stories`} role="tab" aria-selected={tab === "stories"} className={cn("rounded-md px-4 py-1.5 text-sm", tab === "stories" ? "bg-card font-medium shadow-xs" : "text-muted-foreground")}>
          Stories
        </Link>
        <Link href={`${basis}/board?tab=tickets`} role="tab" aria-selected={tab === "tickets"} className={cn("rounded-md px-4 py-1.5 text-sm", tab === "tickets" ? "bg-card font-medium shadow-xs" : "text-muted-foreground")}>
          Tickets
        </Link>
      </div>
      {inhalt}
    </>
  );
}

function Filter({ href, aktiv, children }: { href: string; aktiv: boolean; children: React.ReactNode }) {
  return (
    <Link href={href} className={cn("rounded-full border px-2.5 py-0.5", aktiv ? "bg-primary text-primary-foreground" : "hover:bg-accent")}>
      {children}
    </Link>
  );
}
