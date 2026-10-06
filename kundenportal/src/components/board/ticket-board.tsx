"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useDraggable,
  useDroppable,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { Alert } from "@/components/ui/alert";
import { PrioritaetBadge } from "@/components/status-badges";
import { Badge } from "@/components/ui/badge";
import { ticketStatusSetzen } from "@/lib/aktionen/tickets";
import { formatDatum } from "@/lib/format";
import { cn } from "@/lib/utils";
import { TICKET_STATUS, TICKET_STATUS_LABEL, TICKET_TYP_LABEL } from "@/lib/workflow";
import type { Ticket, TicketStatus } from "@/lib/types";

type Karte = Pick<Ticket, "id" | "titel" | "status" | "typ" | "prioritaet" | "faellig_am" | "story_id">;

/** Ticket-Board. Statuswechsel per Drag & Drop nur für Berater/admin. */
export function TicketBoard({ tickets, darfBearbeiten, basis }: { tickets: Karte[]; darfBearbeiten: boolean; basis: string }) {
  const router = useRouter();
  const [karten, setKarten] = React.useState(tickets);
  const [ziehend, setZiehend] = React.useState(false);
  const [fehler, setFehler] = React.useState<string | null>(null);
  React.useEffect(() => setKarten(tickets), [tickets]);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }), useSensor(KeyboardSensor));

  async function onDragEnd(e: DragEndEvent) {
    setZiehend(false);
    if (!e.over) return;
    const karte = karten.find((k) => k.id === e.active.id);
    const nach = e.over.id as TicketStatus;
    if (!karte || karte.status === nach) return;
    setFehler(null);
    const vorher = karten;
    setKarten((ks) => ks.map((k) => (k.id === karte.id ? { ...k, status: nach } : k)));
    const r = await ticketStatusSetzen(karte.id, nach);
    if (!r?.ok) {
      setKarten(vorher);
      setFehler(r && !r.ok ? r.fehler : "Unbekannter Fehler");
    } else {
      router.refresh();
    }
  }

  return (
    <>
      {fehler && (
        <Alert variant="destructive" className="mb-4">
          {fehler}
        </Alert>
      )}
      <DndContext sensors={sensors} onDragStart={() => setZiehend(true)} onDragEnd={onDragEnd} onDragCancel={() => setZiehend(false)}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {TICKET_STATUS.map((status) => (
            <Spalte key={status} status={status} aktiv={ziehend} anzahl={karten.filter((k) => k.status === status).length} darf={darfBearbeiten}>
              {karten
                .filter((k) => k.status === status)
                .map((k) => (
                  <TicketKarte key={k.id} karte={k} basis={basis} ziehbar={darfBearbeiten} />
                ))}
            </Spalte>
          ))}
        </div>
      </DndContext>
    </>
  );
}

function Spalte({ status, aktiv, anzahl, darf, children }: { status: TicketStatus; aktiv: boolean; anzahl: number; darf: boolean; children: React.ReactNode }) {
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: !darf });
  return (
    <section
      ref={setNodeRef}
      aria-label={TICKET_STATUS_LABEL[status]}
      className={cn(
        "flex w-72 shrink-0 flex-col rounded-xl border bg-muted/50 p-2 transition-colors",
        aktiv && "border-primary/40",
        isOver && "border-primary bg-primary/10",
      )}
    >
      <h3 className="flex items-center justify-between px-2 py-1.5 text-sm font-medium">
        {TICKET_STATUS_LABEL[status]}
        <span className="text-xs text-muted-foreground">{anzahl}</span>
      </h3>
      <div className="flex min-h-24 flex-col gap-2">{children}</div>
    </section>
  );
}

function TicketKarte({ karte, basis, ziehbar }: { karte: Karte; basis: string; ziehbar: boolean }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({ id: karte.id, disabled: !ziehbar });
  const stil = transform ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)` } : undefined;
  return (
    <div
      ref={setNodeRef}
      style={stil}
      {...listeners}
      {...attributes}
      className={cn(
        "rounded-lg border bg-card p-3 text-sm shadow-xs",
        ziehbar ? "cursor-grab active:cursor-grabbing" : "cursor-default",
        isDragging && "z-10 shadow-lg ring-2 ring-primary/40",
      )}
    >
      <Link href={`${basis}/tickets/${karte.id}`} className="font-medium hover:underline" onPointerDown={(e) => e.stopPropagation()}>
        {karte.titel}
      </Link>
      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
        <Badge variant="outline">{TICKET_TYP_LABEL[karte.typ]}</Badge>
        <PrioritaetBadge prioritaet={karte.prioritaet} />
        {karte.faellig_am && <span>fällig {formatDatum(karte.faellig_am)}</span>}
        {karte.story_id && <span>→ Story</span>}
      </div>
    </div>
  );
}
