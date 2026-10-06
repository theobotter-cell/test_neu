import type { ServerClient } from "@/lib/supabase/server";
import { ladeNamen } from "@/lib/daten";
import { formatDatumZeit } from "@/lib/format";
import type { Kommentar } from "@/lib/types";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { AktionForm } from "@/components/aktion-form";
import { AbsendenButton } from "@/components/absenden-button";
import { kommentarAnlegen } from "@/lib/aktionen/kommentare";
import { cn } from "@/lib/utils";

export async function Kommentare({
  supabase,
  customerId,
  storyId,
  ticketId,
  darfKommentieren,
  hinweis,
}: {
  supabase: ServerClient;
  customerId: string;
  storyId?: string;
  ticketId?: string;
  darfKommentieren: boolean;
  hinweis?: string;
}) {
  let abfrage = supabase.from("comments").select("*").eq("customer_id", customerId).order("created_at");
  abfrage = storyId ? abfrage.eq("story_id", storyId) : abfrage.eq("ticket_id", ticketId!);
  const { data } = await abfrage;
  const kommentare = (data ?? []) as Kommentar[];
  const namen = await ladeNamen(supabase, kommentare.map((k) => k.autor_id));

  return (
    <div className="space-y-4">
      {kommentare.length === 0 && <p className="text-sm text-muted-foreground">Noch keine Kommentare.</p>}
      <ul className="space-y-3">
        {kommentare.map((k) => {
          const vomKunden = k.autor_rolle === "kunde";
          return (
            <li key={k.id} className={cn("rounded-lg border p-3", vomKunden ? "bg-card" : "bg-primary/5")}>
              <div className="mb-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground">{(k.autor_id && namen.get(k.autor_id)) ?? "Unbekannt"}</span>
                <Badge variant={vomKunden ? "outline" : "secondary"}>{vomKunden ? "Kunde" : "Linxys"}</Badge>
                <span>{formatDatumZeit(k.created_at)}</span>
              </div>
              <p className="text-sm whitespace-pre-wrap">{k.text}</p>
            </li>
          );
        })}
      </ul>
      {darfKommentieren && (
        <AktionForm
          id="antworten"
          aktion={kommentarAnlegen.bind(null, { customerId, storyId, ticketId })}
          zuruecksetzen
          className="space-y-2"
        >
          <Textarea name="text" placeholder="Kommentar schreiben …" required rows={3} aria-label="Kommentar" />
          {hinweis && <p className="text-xs text-muted-foreground">{hinweis}</p>}
          <AbsendenButton size="sm">Kommentar senden</AbsendenButton>
        </AktionForm>
      )}
    </div>
  );
}
