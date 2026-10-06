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
  type DragStartEvent,
} from "@dnd-kit/core";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog } from "@/components/dialog";
import { Feld } from "@/components/feld";
import { storyUebergang } from "@/lib/aktionen/stories";
import { formatStunden } from "@/lib/format";
import { cn } from "@/lib/utils";
import { STORY_STATUS, STORY_STATUS_LABEL, erlaubteUebergaenge, type Uebergang } from "@/lib/workflow";
import type { Rolle, Story, StoryStatus } from "@/lib/types";

type Karte = Pick<Story, "id" | "titel" | "status" | "schaetzung_stunden" | "ticket_id">;

export function StoryBoard({
  stories,
  rolle,
  darfBearbeiten,
  basis,
}: {
  stories: Karte[];
  rolle: Rolle;
  darfBearbeiten: boolean;
  basis: string;
}) {
  const router = useRouter();
  const [karten, setKarten] = React.useState(stories);
  const [ziehend, setZiehend] = React.useState<Karte | null>(null);
  const [fehler, setFehler] = React.useState<string | null>(null);
  const [offen, setOffen] = React.useState<{ karte: Karte; uebergang: Uebergang } | null>(null);
  const [laeuft, setLaeuft] = React.useState(false);

  React.useEffect(() => setKarten(stories), [stories]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor),
  );

  const erlaubteZiele = React.useMemo(
    () => new Set(ziehend ? erlaubteUebergaenge(ziehend.status, rolle, darfBearbeiten).map((u) => u.nach) : []),
    [ziehend, rolle, darfBearbeiten],
  );

  async function ausfuehren(karte: Karte, u: Uebergang, kommentar?: string, schaetzung?: number) {
    setFehler(null);
    setLaeuft(true);
    const vorher = karten;
    setKarten((ks) => ks.map((k) => (k.id === karte.id ? { ...k, status: u.nach } : k)));
    const r = await storyUebergang({ storyId: karte.id, nach: u.nach, kommentar, schaetzung });
    setLaeuft(false);
    if (!r?.ok) {
      setKarten(vorher);
      setFehler(r && !r.ok ? r.fehler : "Unbekannter Fehler");
      return false;
    }
    router.refresh();
    return true;
  }

  function onDragStart(e: DragStartEvent) {
    setZiehend(karten.find((k) => k.id === e.active.id) ?? null);
  }

  function onDragEnd(e: DragEndEvent) {
    const karte = ziehend;
    setZiehend(null);
    if (!karte || !e.over) return;
    const nach = e.over.id as StoryStatus;
    if (nach === karte.status) return;
    const u = erlaubteUebergaenge(karte.status, rolle, darfBearbeiten).find((x) => x.nach === nach);
    if (!u) return; // In der Oberfläche nicht möglich – Server würde ebenfalls ablehnen
    if (u.kommentarPflicht || u.schaetzungPflicht) {
      setOffen({ karte, uebergang: u });
    } else {
      void ausfuehren(karte, u);
    }
  }

  return (
    <>
      {fehler && (
        <Alert variant="destructive" className="mb-4">
          {fehler}
        </Alert>
      )}
      <DndContext sensors={sensors} onDragStart={onDragStart} onDragEnd={onDragEnd} onDragCancel={() => setZiehend(null)}>
        <div className="flex gap-3 overflow-x-auto pb-4">
          {STORY_STATUS.map((status) => (
            <Spalte
              key={status}
              status={status}
              aktiv={ziehend !== null}
              erlaubt={erlaubteZiele.has(status)}
              istQuelle={ziehend?.status === status}
              anzahl={karten.filter((k) => k.status === status).length}
            >
              {karten
                .filter((k) => k.status === status)
                .map((k) => (
                  <StoryKarte
                    key={k.id}
                    karte={k}
                    basis={basis}
                    ziehbar={!laeuft && erlaubteUebergaenge(k.status, rolle, darfBearbeiten).length > 0}
                  />
                ))}
            </Spalte>
          ))}
        </div>
      </DndContext>

      <UebergangDialog
        offen={offen}
        onSchliessen={() => setOffen(null)}
        onBestaetigen={async (kommentar, schaetzung) => {
          if (!offen) return;
          const ok = await ausfuehren(offen.karte, offen.uebergang, kommentar, schaetzung);
          if (ok) setOffen(null);
        }}
        laeuft={laeuft}
      />
    </>
  );
}

function Spalte({
  status,
  aktiv,
  erlaubt,
  istQuelle,
  anzahl,
  children,
}: {
  status: StoryStatus;
  aktiv: boolean;
  erlaubt: boolean;
  istQuelle: boolean;
  anzahl: number;
  children: React.ReactNode;
}) {
  // Nicht erlaubte Spalten sind als Ablageziel deaktiviert
  const { setNodeRef, isOver } = useDroppable({ id: status, disabled: !erlaubt });
  return (
    <section
      ref={setNodeRef}
      aria-label={STORY_STATUS_LABEL[status]}
      className={cn(
        "flex w-64 shrink-0 flex-col rounded-xl border bg-muted/50 p-2 transition-colors",
        aktiv && erlaubt && "border-primary/60 bg-primary/5",
        aktiv && !erlaubt && !istQuelle && "opacity-50",
        isOver && erlaubt && "border-primary bg-primary/10",
      )}
    >
      <h3 className="flex items-center justify-between px-2 py-1.5 text-sm font-medium">
        {STORY_STATUS_LABEL[status]}
        <span className="text-xs text-muted-foreground">{anzahl}</span>
      </h3>
      <div className="flex min-h-24 flex-col gap-2">{children}</div>
    </section>
  );
}

function StoryKarte({ karte, basis, ziehbar }: { karte: Karte; basis: string; ziehbar: boolean }) {
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
      <Link href={`${basis}/stories/${karte.id}`} className="font-medium hover:underline" onPointerDown={(e) => e.stopPropagation()}>
        {karte.titel}
      </Link>
      <div className="mt-1.5 flex items-center gap-2 text-xs text-muted-foreground">
        {karte.schaetzung_stunden && <span>Schätzung {formatStunden(karte.schaetzung_stunden)}</span>}
        {karte.ticket_id && <span>aus Ticket</span>}
      </div>
    </div>
  );
}

function UebergangDialog({
  offen,
  onSchliessen,
  onBestaetigen,
  laeuft,
}: {
  offen: { karte: Karte; uebergang: Uebergang } | null;
  onSchliessen: () => void;
  onBestaetigen: (kommentar?: string, schaetzung?: number) => void;
  laeuft: boolean;
}) {
  const [kommentar, setKommentar] = React.useState("");
  const [schaetzung, setSchaetzung] = React.useState("");
  const [hinweis, setHinweis] = React.useState<string | null>(null);
  React.useEffect(() => {
    setKommentar("");
    setSchaetzung("");
    setHinweis(null);
  }, [offen]);
  if (!offen) return null;
  const u = offen.uebergang;

  return (
    <Dialog offen titel={u.label} beschreibung={`„${offen.karte.titel}“`} onSchliessen={onSchliessen}>
      <form
        className="grid gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          const zahl = Number(schaetzung.replace(",", "."));
          if (u.schaetzungPflicht && !(zahl > 0)) return setHinweis("Bitte eine Schätzung in Stunden angeben (z. B. 4,5).");
          if (u.kommentarPflicht && !kommentar.trim()) return setHinweis("Bitte begründen Sie die Ablehnung.");
          onBestaetigen(kommentar.trim() || undefined, u.schaetzungPflicht ? zahl : undefined);
        }}
      >
        {u.schaetzungPflicht && (
          <Feld label="Schätzung in Stunden" htmlFor="schaetzung" hinweis="Aus der Entwickleraufgabe in Bitrix24">
            <Input id="schaetzung" inputMode="decimal" value={schaetzung} onChange={(e) => setSchaetzung(e.target.value)} required />
          </Feld>
        )}
        <Feld label={u.kommentarPflicht ? "Begründung (Pflicht)" : "Kommentar (optional)"} htmlFor="kommentar">
          <Textarea id="kommentar" value={kommentar} onChange={(e) => setKommentar(e.target.value)} required={u.kommentarPflicht} />
        </Feld>
        {hinweis && <Alert variant="destructive">{hinweis}</Alert>}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onSchliessen}>
            Abbrechen
          </Button>
          <Button type="submit" variant={u.negativ ? "destructive" : "default"} disabled={laeuft}>
            {laeuft ? "Bitte warten …" : u.label}
          </Button>
        </div>
      </form>
    </Dialog>
  );
}
