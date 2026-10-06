import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ladeKundenKontext } from "@/lib/auth";
import { ladeNamen } from "@/lib/daten";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Seitenkopf } from "@/components/seitenkopf";
import { StoryStatusBadge } from "@/components/status-badges";
import { AktionForm } from "@/components/aktion-form";
import { AbsendenButton } from "@/components/absenden-button";
import { StoryFelder } from "@/components/story-formular";
import { Kommentare } from "@/components/kommentare";
import { UebergangButton } from "@/components/uebergang-button";
import { UebergangFormular } from "@/components/uebergang-formular";
import { ZeitenTabelle, type ZeitZeile } from "@/components/zeiten-tabelle";
import { LoeschenButton } from "@/components/loeschen-button";
import { storyBearbeiten, storyLoeschen, storyUebergangFormular } from "@/lib/aktionen/stories";
import { formatDatumZeit, formatStunden } from "@/lib/format";
import { AKTION_LABEL, STORY_STATUS_LABEL, erlaubteUebergaenge } from "@/lib/workflow";
import type { Approval, Story } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Story" };

export default async function StoryDetail({ params }: { params: Promise<{ cid: string; sid: string }> }) {
  const { cid, sid } = await params;
  const ctx = await ladeKundenKontext(cid);
  const { supabase } = ctx;
  const basis = `/k/${cid}`;

  const { data: story } = await supabase.from("stories").select("*").eq("id", sid).eq("customer_id", cid).maybeSingle<Story>();
  if (!story) notFound();

  const [verlaufRes, zeitenRes, ticketRes] = await Promise.all([
    supabase.from("approvals").select("*").eq("story_id", sid).order("created_at"),
    supabase.from("time_entries").select("*").eq("story_id", sid).order("datum", { ascending: false }),
    story.ticket_id ? supabase.from("tickets").select("id, titel").eq("id", story.ticket_id).maybeSingle() : Promise.resolve({ data: null }),
  ]);
  const verlauf = (verlaufRes.data ?? []) as Approval[];
  const zeiten = (zeitenRes.data ?? []) as ZeitZeile[];
  const namen = await ladeNamen(supabase, [...verlauf.map((v) => v.user_id), ...zeiten.map((z) => z.erfasst_von), story.erstellt_von]);

  const ist = zeiten.filter((z) => z.abrechenbar).reduce((s, z) => s + Number(z.dauer_stunden), 0);
  const schaetzung = story.schaetzung_stunden === null ? null : Number(story.schaetzung_stunden);
  const uebergaenge = erlaubteUebergaenge(story.status, ctx.profil.rolle, ctx.darfBearbeiten);
  const darfBearbeiten = ctx.darfBearbeiten || (ctx.istKunde && story.status === "entwurf");
  const darfLoeschen = ctx.darfBearbeiten || (ctx.istKunde && story.status === "entwurf" && story.erstellt_von === ctx.profil.id);

  return (
    <>
      <Seitenkopf
        titel={story.titel}
        beschreibung={
          <span className="flex flex-wrap items-center gap-2">
            <StoryStatusBadge status={story.status} />
            <span>angelegt von {(story.erstellt_von && namen.get(story.erstellt_von)) ?? "–"} am {formatDatumZeit(story.created_at)}</span>
            {ticketRes.data && (
              <Link href={`${basis}/tickets/${ticketRes.data.id}`} className="text-primary hover:underline">
                aus Ticket „{ticketRes.data.titel}“
              </Link>
            )}
          </span>
        }
        aktionen={
          <Link href={`${basis}/board`} className="text-sm text-muted-foreground hover:underline">
            Zurück zum Board
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>{darfBearbeiten ? "Story bearbeiten" : "Beschreibung"}</CardTitle>
            </CardHeader>
            <CardContent>
              {darfBearbeiten ? (
                <AktionForm aktion={storyBearbeiten.bind(null, sid)} className="grid gap-4">
                  <StoryFelder story={story} />
                  <div className="flex flex-wrap gap-2">
                    <AbsendenButton>Speichern</AbsendenButton>
                  </div>
                </AktionForm>
              ) : (
                <div className="space-y-4 text-sm">
                  <p className="whitespace-pre-wrap">{story.beschreibung || "–"}</p>
                  <div>
                    <h4 className="mb-1 font-medium">Akzeptanzkriterien</h4>
                    <p className="whitespace-pre-wrap">{story.akzeptanzkriterien || "–"}</p>
                  </div>
                </div>
              )}
              {darfLoeschen && (
                <div className="mt-4 border-t pt-4">
                  <LoeschenButton aktion={storyLoeschen.bind(null, sid)} bestaetigung="Story wirklich löschen?" label="Story löschen" />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Kommentare</CardTitle>
            </CardHeader>
            <CardContent>
              <Kommentare supabase={supabase} customerId={cid} storyId={sid} darfKommentieren={ctx.darfMitwirken} />
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
              <CardTitle>Schätzung und Aufwand</CardTitle>
            </CardHeader>
            <CardContent>
              <dl className="grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-muted-foreground">Schätzung</dt>
                  <dd className="text-lg font-semibold">{schaetzung === null ? "–" : formatStunden(schaetzung)}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Ist (abrechenbar)</dt>
                  <dd className={cn("text-lg font-semibold", schaetzung !== null && ist > schaetzung && "text-destructive")}>
                    {formatStunden(ist)}
                  </dd>
                </div>
              </dl>
              {schaetzung !== null && schaetzung > 0 && (
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className={cn("h-full", ist > schaetzung ? "bg-destructive" : "bg-primary")}
                    style={{ width: `${Math.min(100, (ist / schaetzung) * 100)}%` }}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Nächster Schritt</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {uebergaenge.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  {story.status === "abgenommen" ? "Die Story ist abgenommen." : "Aktuell ist die andere Seite am Zug."}
                </p>
              ) : (
                uebergaenge.map((u) =>
                  u.kommentarPflicht || u.schaetzungPflicht ? (
                    <UebergangFormular
                      key={u.nach}
                      aktion={storyUebergangFormular.bind(null, sid, u.nach)}
                      label={u.label}
                      kommentarPflicht={u.kommentarPflicht}
                      schaetzungPflicht={u.schaetzungPflicht}
                      negativ={u.negativ}
                    />
                  ) : (
                    <UebergangButton key={u.nach} aktion={storyUebergangFormular.bind(null, sid, u.nach)} label={u.label} />
                  ),
                )
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Verlauf</CardTitle>
            </CardHeader>
            <CardContent>
              {verlauf.length === 0 ? (
                <p className="text-sm text-muted-foreground">Noch keine Statuswechsel.</p>
              ) : (
                <ol className="space-y-3 border-l pl-4 text-sm">
                  {verlauf.map((v) => (
                    <li key={v.id} className="relative">
                      <span className="absolute top-1.5 -left-[21px] size-2.5 rounded-full bg-primary" aria-hidden />
                      <p className="font-medium">{AKTION_LABEL[v.aktion] ?? v.aktion}</p>
                      <p className="text-xs text-muted-foreground">
                        {(v.user_id && namen.get(v.user_id)) ?? "–"} · {formatDatumZeit(v.created_at)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {v.von_status ? STORY_STATUS_LABEL[v.von_status] : "–"} → {STORY_STATUS_LABEL[v.nach_status]}
                      </p>
                      {v.kommentar && <p className="mt-1 rounded bg-muted p-2 text-xs whitespace-pre-wrap">{v.kommentar}</p>}
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
