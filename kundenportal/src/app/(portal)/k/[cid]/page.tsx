import Link from "next/link";
import { CalendarPlus } from "lucide-react";
import { ladeKundenKontext } from "@/lib/auth";
import { ladeAktivitaeten, ladeKontingentStand } from "@/lib/daten";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Seitenkopf } from "@/components/seitenkopf";
import { KontingentBalken } from "@/components/kontingent-balken";
import { StoryStatusBadge, TicketStatusBadge } from "@/components/status-badges";
import { UebergangButton } from "@/components/uebergang-button";
import { storyUebergangFormular } from "@/lib/aktionen/stories";
import { DASHBOARD_STUNDEN_TAGE } from "@/lib/config";
import { formatDatum, formatDatumZeit, formatEuro, formatStunden, heuteIso, plusTage } from "@/lib/format";
import type { Kontingent, Story, Ticket } from "@/lib/types";

export default async function KundenUebersicht({ params }: { params: Promise<{ cid: string }> }) {
  const { cid } = await params;
  const ctx = await ladeKundenKontext(cid);
  const { supabase, kunde, profil, istKunde } = ctx;
  const basis = `/k/${cid}`;
  const seit = plusTage(heuteIso(), -DASHBOARD_STUNDEN_TAGE);

  const [stand, kontingente, wartendeStories, wartendeTickets, beiLinxysStories, beiLinxysTickets, zeiten, aktivitaeten, hauptberater] =
    await Promise.all([
      ladeKontingentStand(supabase, cid),
      supabase.from("kontingente").select("*").eq("customer_id", cid).order("gebucht_am", { ascending: false }),
      supabase.from("stories").select("id, titel, status, schaetzung_stunden, status_seit").eq("customer_id", cid).in("status", ["geschaetzt", "zur_abnahme"]).order("status_seit"),
      supabase.from("tickets").select("id, titel, status, status_seit").eq("customer_id", cid).eq("status", "wartet_auf_kunde").order("status_seit"),
      supabase.from("stories").select("id, titel, status").eq("customer_id", cid).in("status", ["zur_schaetzung_freigegeben", "zur_umsetzung_freigegeben", "in_umsetzung"]),
      supabase.from("tickets").select("id, titel, status").eq("customer_id", cid).in("status", ["neu", "in_arbeit"]),
      supabase.from("time_entries").select("dauer_stunden, kategorie").eq("customer_id", cid).gte("datum", seit),
      ladeAktivitaeten(supabase, cid, 8),
      kunde.hauptberater_id
        ? supabase.from("profiles").select("name, buchungslink").eq("id", kunde.hauptberater_id).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

  const summe = (kat: string) =>
    (zeiten.data ?? []).filter((z) => z.kategorie === kat).reduce((s, z) => s + Number(z.dauer_stunden), 0);
  const buchungslink = hauptberater.data?.buchungslink;
  const stories = (wartendeStories.data ?? []) as Pick<Story, "id" | "titel" | "status" | "schaetzung_stunden" | "status_seit">[];
  const tickets = (wartendeTickets.data ?? []) as Pick<Ticket, "id" | "titel" | "status" | "status_seit">[];
  const wartetAnzahl = stories.length + tickets.length;

  return (
    <>
      <Seitenkopf
        titel={istKunde ? `Willkommen, ${profil.name}` : kunde.firmenname}
        beschreibung={istKunde ? kunde.firmenname : hauptberater.data ? `Hauptberater: ${hauptberater.data.name}` : undefined}
        aktionen={
          <>
            {ctx.darfMitwirken && (
              <>
                <Link href={`${basis}/tickets/neu`} className={buttonVariants({ variant: "outline" })}>
                  Neues Ticket
                </Link>
                <Link href={`${basis}/stories/neu`} className={buttonVariants({ variant: "outline" })}>
                  Neue Story
                </Link>
              </>
            )}
            {buchungslink && (
              <a href={buchungslink} target="_blank" rel="noopener noreferrer" className={buttonVariants()}>
                <CalendarPlus /> Termin buchen
              </a>
            )}
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Stundenkontingent</CardTitle>
            <CardDescription>Gebuchte Kontingente werden aufaddiert und verfallen nicht.</CardDescription>
          </CardHeader>
          <CardContent>
            <KontingentBalken stand={stand} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Letzte {DASHBOARD_STUNDEN_TAGE} Tage</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-muted-foreground">Beratung</dt>
                <dd className="text-xl font-semibold">{formatStunden(summe("beratung"))}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Entwicklung</dt>
                <dd className="text-xl font-semibold">{formatStunden(summe("entwicklung"))}</dd>
              </div>
            </dl>
            <Link href={`${basis}/zeiten`} className="mt-4 inline-block text-sm text-primary hover:underline">
              Alle Zeiten ansehen
            </Link>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>
              {istKunde ? "Wartet auf Sie" : "Wartet auf den Kunden"}
              {wartetAnzahl > 0 && (
                <span className="ml-2 rounded-full bg-warning/30 px-2 py-0.5 text-xs font-medium text-amber-900">{wartetAnzahl}</span>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {wartetAnzahl === 0 ? (
              <p className="text-sm text-muted-foreground">Aktuell ist nichts offen.</p>
            ) : (
              <ul className="divide-y">
                {stories.map((s) => (
                  <li key={s.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <Link href={`${basis}/stories/${s.id}`} className="font-medium hover:underline">
                        {s.titel}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <StoryStatusBadge status={s.status} />
                        {s.status === "geschaetzt" && <span>Schätzung: {formatStunden(s.schaetzung_stunden)}</span>}
                        <span>seit {formatDatum(s.status_seit)}</span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {(istKunde || profil.rolle === "admin") && (
                        <UebergangButton
                          aktion={storyUebergangFormular.bind(null, s.id, s.status === "geschaetzt" ? "zur_umsetzung_freigegeben" : "abgenommen")}
                          label={s.status === "geschaetzt" ? "Zur Umsetzung freigeben" : "Abnehmen"}
                        />
                      )}
                      <Link href={`${basis}/stories/${s.id}`} className={buttonVariants({ size: "sm", variant: "outline" })}>
                        {istKunde ? "Prüfen / ablehnen" : "Öffnen"}
                      </Link>
                    </div>
                  </li>
                ))}
                {tickets.map((t) => (
                  <li key={t.id} className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <Link href={`${basis}/tickets/${t.id}`} className="font-medium hover:underline">
                        {t.titel}
                      </Link>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        <TicketStatusBadge status={t.status} />
                        <span>seit {formatDatum(t.status_seit)}</span>
                      </div>
                    </div>
                    <Link href={`${basis}/tickets/${t.id}#antworten`} className={buttonVariants({ size: "sm" })}>
                      Antworten
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>In Arbeit bei Linxys</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {(beiLinxysStories.data ?? []).length + (beiLinxysTickets.data ?? []).length === 0 ? (
              <p className="text-muted-foreground">Keine offenen Punkte.</p>
            ) : (
              <ul className="space-y-2">
                {(beiLinxysStories.data ?? []).map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2">
                    <Link href={`${basis}/stories/${s.id}`} className="truncate hover:underline">
                      {s.titel}
                    </Link>
                    <StoryStatusBadge status={s.status} />
                  </li>
                ))}
                {(beiLinxysTickets.data ?? []).map((t) => (
                  <li key={t.id} className="flex items-center justify-between gap-2">
                    <Link href={`${basis}/tickets/${t.id}`} className="truncate hover:underline">
                      {t.titel}
                    </Link>
                    <TicketStatusBadge status={t.status} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Letzte Aktivitäten</CardTitle>
          </CardHeader>
          <CardContent>
            {aktivitaeten.length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Aktivitäten.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {aktivitaeten.map((a, i) => (
                  <li key={i} className="flex flex-col sm:flex-row sm:gap-4">
                    <span className="w-36 shrink-0 text-muted-foreground tabular-nums">{formatDatumZeit(a.zeit)}</span>
                    {a.link ? (
                      <Link href={a.link} className="hover:underline">
                        {a.text}
                      </Link>
                    ) : (
                      <span>{a.text}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Gebuchte Leistungen</CardTitle>
          </CardHeader>
          <CardContent>
            {(kontingente.data ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Noch keine Leistungen gebucht.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {((kontingente.data ?? []) as Kontingent[]).map((k) => (
                  <li key={k.id} className="flex justify-between gap-2">
                    <span>
                      {k.leistung}
                      <span className="block text-xs text-muted-foreground">
                        {formatDatum(k.gebucht_am)}
                        {k.betrag !== null && ` · ${formatEuro(k.betrag)}`}
                      </span>
                    </span>
                    <span className="font-medium tabular-nums">{formatStunden(k.stunden)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
