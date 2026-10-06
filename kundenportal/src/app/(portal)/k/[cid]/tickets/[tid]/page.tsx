import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ladeKundenKontext } from "@/lib/auth";
import { ladeBerater, ladeNamen } from "@/lib/daten";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert } from "@/components/ui/alert";
import { Seitenkopf } from "@/components/seitenkopf";
import { PrioritaetBadge, TicketStatusBadge } from "@/components/status-badges";
import { AktionForm } from "@/components/aktion-form";
import { AbsendenButton } from "@/components/absenden-button";
import { AktionButton } from "@/components/aktion-button";
import { TicketFelder } from "@/components/ticket-felder";
import { Kommentare } from "@/components/kommentare";
import { ZeitenTabelle, type ZeitZeile } from "@/components/zeiten-tabelle";
import { ticketAktualisieren, ticketInStoryUmwandeln } from "@/lib/aktionen/tickets";
import { formatDatum, formatDatumZeit } from "@/lib/format";
import { TICKET_TYP_LABEL } from "@/lib/workflow";
import type { Ticket } from "@/lib/types";

export const metadata: Metadata = { title: "Ticket" };

export default async function TicketDetail({ params }: { params: Promise<{ cid: string; tid: string }> }) {
  const { cid, tid } = await params;
  const ctx = await ladeKundenKontext(cid);
  const { supabase } = ctx;
  const basis = `/k/${cid}`;

  const { data: ticket } = await supabase.from("tickets").select("*").eq("id", tid).eq("customer_id", cid).maybeSingle<Ticket>();
  if (!ticket) notFound();

  const [zeitenRes, storyRes, berater] = await Promise.all([
    supabase.from("time_entries").select("*").eq("ticket_id", tid).order("datum", { ascending: false }),
    ticket.story_id ? supabase.from("stories").select("id, titel").eq("id", ticket.story_id).maybeSingle() : Promise.resolve({ data: null }),
    ctx.darfBearbeiten ? ladeBerater(supabase) : Promise.resolve([]),
  ]);
  const zeiten = (zeitenRes.data ?? []) as ZeitZeile[];
  const namen = await ladeNamen(supabase, [ticket.erstellt_von, ticket.zustaendig_id, ...zeiten.map((z) => z.erfasst_von)]);

  return (
    <>
      <Seitenkopf
        titel={ticket.titel}
        beschreibung={
          <span className="flex flex-wrap items-center gap-2">
            <TicketStatusBadge status={ticket.status} />
            <Badge variant="outline">{TICKET_TYP_LABEL[ticket.typ]}</Badge>
            <PrioritaetBadge prioritaet={ticket.prioritaet} />
            <span>
              von {(ticket.erstellt_von && namen.get(ticket.erstellt_von)) ?? "–"} am {formatDatumZeit(ticket.created_at)}
            </span>
          </span>
        }
        aktionen={
          <Link href={`${basis}/board?tab=tickets`} className="text-sm text-muted-foreground hover:underline">
            Zurück zum Board
          </Link>
        }
      />

      {ticket.status === "wartet_auf_kunde" && ctx.istKunde && (
        <Alert variant="warning" className="mb-6">
          Dieses Ticket wartet auf Ihre Rückmeldung. Ihr Kommentar unten setzt es automatisch zurück in Bearbeitung.
        </Alert>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{ctx.darfBearbeiten ? "Ticket bearbeiten" : "Beschreibung"}</CardTitle>
            </CardHeader>
            <CardContent>
              {ctx.darfBearbeiten ? (
                <AktionForm aktion={ticketAktualisieren.bind(null, tid)} className="grid gap-4">
                  <TicketFelder ticket={ticket} intern berater={berater} />
                  <AbsendenButton className="justify-self-start">Speichern</AbsendenButton>
                </AktionForm>
              ) : (
                <p className="text-sm whitespace-pre-wrap">{ticket.beschreibung || "–"}</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Kommentare</CardTitle>
            </CardHeader>
            <CardContent>
              <Kommentare
                supabase={supabase}
                customerId={cid}
                ticketId={tid}
                darfKommentieren={ctx.darfMitwirken}
                hinweis={ctx.istKunde && ticket.status === "wartet_auf_kunde" ? "Mit Ihrem Kommentar geht das Ticket zurück an Linxys." : undefined}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Verknüpfte Zeiten</CardTitle>
            </CardHeader>
            <CardContent>
              {zeiten.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Zeiten erfasst.</p>
              ) : (
                <ZeitenTabelle zeiten={zeiten} namen={namen} istKunde={!ctx.intern} basis={basis} />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Details</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Zuständig</dt>
                  <dd>{(ticket.zustaendig_id && namen.get(ticket.zustaendig_id)) ?? "–"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Fällig am</dt>
                  <dd>{formatDatum(ticket.faellig_am)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Story</dt>
                  <dd>
                    {storyRes.data ? (
                      <Link href={`${basis}/stories/${storyRes.data.id}`} className="text-primary hover:underline">
                        {storyRes.data.titel}
                      </Link>
                    ) : (
                      "–"
                    )}
                  </dd>
                </div>
              </dl>
              {ctx.darfBearbeiten && !ticket.story_id && (
                <div className="mt-4 border-t pt-4">
                  <AktionButton
                    aktion={ticketInStoryUmwandeln.bind(null, tid)}
                    bestaetigung="Ticket in eine Story umwandeln? Das Ticket wird dabei erledigt."
                  >
                    In Story umwandeln
                  </AktionButton>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
