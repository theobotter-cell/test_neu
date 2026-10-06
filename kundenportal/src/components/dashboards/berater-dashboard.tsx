import Link from "next/link";
import type { ServerClient } from "@/lib/supabase/server";
import type { KundenKennzahlen, Profil, Story, Ticket } from "@/lib/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Leer, Seitenkopf } from "@/components/seitenkopf";
import { StoryStatusBadge, PrioritaetBadge } from "@/components/status-badges";
import { formatDatum, formatMonat, formatStunden, vormonat } from "@/lib/format";
import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export async function BeraterDashboard({ supabase, profil }: { supabase: ServerClient; profil: Profil }) {
  const monat = vormonat();
  const [kennzahlen, stories, tickets, kommentare, abschluesse] = await Promise.all([
    supabase.from("kunden_kennzahlen").select("*").order("firmenname"),
    supabase
      .from("stories")
      .select("id, customer_id, titel, status, status_seit")
      .in("status", ["zur_schaetzung_freigegeben", "zur_umsetzung_freigegeben"])
      .order("status_seit"),
    supabase.from("tickets").select("id, customer_id, titel, prioritaet, created_at").eq("status", "neu").order("created_at"),
    supabase.from("offene_kundenkommentare").select("*").order("created_at"),
    supabase.from("monatsabschluesse").select("customer_id, status").eq("monat", monat),
  ]);

  // Für admin: alle Kunden. Für Berater liefert RLS nur die zugeordneten.
  const kunden = (kennzahlen.data ?? []) as KundenKennzahlen[];
  const firmen = new Map(kunden.map((k) => [k.customer_id, k.firmenname]));
  const abgeschlossen = new Set((abschluesse.data ?? []).filter((a) => a.status === "abgeschlossen").map((a) => a.customer_id));
  const offeneAbschluesse = kunden.filter((k) => !abgeschlossen.has(k.customer_id));
  const wartendeStories = (stories.data ?? []) as Pick<Story, "id" | "customer_id" | "titel" | "status" | "status_seit">[];
  const neueTickets = (tickets.data ?? []) as Pick<Ticket, "id" | "customer_id" | "titel" | "prioritaet" | "created_at">[];
  const offeneKommentare = kommentare.data ?? [];

  return (
    <>
      <Seitenkopf
        titel={`Hallo ${profil.name.split(" ")[0]}`}
        beschreibung={profil.rolle === "admin" ? "Überblick über alle Kunden" : "Ihre zugeordneten Kunden und was auf Sie wartet"}
        aktionen={
          <Link href="/zeiterfassung" className={buttonVariants()}>
            Zeit erfassen
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Kunden</CardTitle>
          </CardHeader>
          <CardContent>
            {kunden.length === 0 ? (
              <Leer>Ihnen sind noch keine Kunden zugeordnet.</Leer>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Kunde</TableHead>
                    <TableHead className="text-right">Restkontingent</TableHead>
                    <TableHead className="text-right">Offene Punkte</TableHead>
                    <TableHead className="text-right">Wartet auf Linxys</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {kunden.map((k) => (
                    <TableRow key={k.customer_id}>
                      <TableCell>
                        <Link href={`/k/${k.customer_id}`} className="font-medium hover:underline">
                          {k.firmenname}
                        </Link>
                      </TableCell>
                      <TableCell className={cn("text-right tabular-nums", Number(k.rest) < 0 && "font-semibold text-destructive")}>
                        {formatStunden(k.rest)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums">{k.offene_stories + k.offene_tickets}</TableCell>
                      <TableCell className="text-right">
                        {k.wartet_auf_berater > 0 ? <Badge variant="warning">{k.wartet_auf_berater}</Badge> : "–"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Monatsabschluss {formatMonat(monat)}</CardTitle>
            <CardDescription>Noch nicht abgeschlossene Kunden</CardDescription>
          </CardHeader>
          <CardContent>
            {offeneAbschluesse.length === 0 ? (
              <p className="text-sm text-muted-foreground">Alle Monatsabschlüsse sind erledigt.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {offeneAbschluesse.map((k) => (
                  <li key={k.customer_id}>
                    <Link href={`/k/${k.customer_id}/monatsabschluss?monat=${monat}`} className="hover:underline">
                      {k.firmenname}
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      <h2 className="mt-8 mb-3 text-lg font-semibold">Wartet auf Sie</h2>
      <div className="grid gap-6 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Freigegebene Stories</CardTitle>
            <CardDescription>Zu schätzen oder umzusetzen</CardDescription>
          </CardHeader>
          <CardContent>
            {wartendeStories.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nichts offen.</p>
            ) : (
              <ul className="space-y-3">
                {wartendeStories.map((s) => (
                  <li key={s.id} className="text-sm">
                    <Link href={`/k/${s.customer_id}/stories/${s.id}`} className="font-medium hover:underline">
                      {s.titel}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{firmen.get(s.customer_id)}</span>
                      <StoryStatusBadge status={s.status} />
                      <span>seit {formatDatum(s.status_seit)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Neue Tickets</CardTitle>
          </CardHeader>
          <CardContent>
            {neueTickets.length === 0 ? (
              <p className="text-sm text-muted-foreground">Keine neuen Tickets.</p>
            ) : (
              <ul className="space-y-3">
                {neueTickets.map((t) => (
                  <li key={t.id} className="text-sm">
                    <Link href={`/k/${t.customer_id}/tickets/${t.id}`} className="font-medium hover:underline">
                      {t.titel}
                    </Link>
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>{firmen.get(t.customer_id)}</span>
                      <PrioritaetBadge prioritaet={t.prioritaet} />
                      <span>{formatDatum(t.created_at)}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Unbeantwortete Kundenkommentare</CardTitle>
          </CardHeader>
          <CardContent>
            {offeneKommentare.length === 0 ? (
              <p className="text-sm text-muted-foreground">Alle Kommentare beantwortet.</p>
            ) : (
              <ul className="space-y-3">
                {offeneKommentare.map((k) => (
                  <li key={k.id} className="text-sm">
                    <Link
                      href={k.story_id ? `/k/${k.customer_id}/stories/${k.story_id}` : `/k/${k.customer_id}/tickets/${k.ticket_id}`}
                      className="font-medium hover:underline"
                    >
                      {k.titel}
                    </Link>
                    <p className="line-clamp-2 text-muted-foreground">„{k.text}“</p>
                    <p className="text-xs text-muted-foreground">
                      {firmen.get(k.customer_id)} · {formatDatum(k.created_at)}
                    </p>
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
