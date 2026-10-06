import Link from "next/link";
import type { ServerClient } from "@/lib/supabase/server";
import type { KundenKennzahlen } from "@/lib/types";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Seitenkopf, Leer } from "@/components/seitenkopf";
import { Ampel } from "@/components/ampel";
import { AMPEL_GRUND_LABEL, ampelBewerten, type AmpelGrund } from "@/lib/cs-ampel";
import { formatDatum, formatZahl } from "@/lib/format";
import { ladeNamen } from "@/lib/daten";
import { cn } from "@/lib/utils";

const FILTER: AmpelGrund[] = ["restkontingent", "inaktiv", "wartet_beim_kunden", "ablehnung"];

export async function CsDashboard({
  supabase,
  filter,
  basis = "/",
  titel = "Customer Success",
}: {
  supabase: ServerClient;
  filter?: string;
  basis?: string;
  titel?: string;
}) {
  const { data } = await supabase.from("kunden_kennzahlen").select("*").order("firmenname");
  const jetzt = new Date();
  const alle = ((data ?? []) as KundenKennzahlen[]).map((k) => ({ k, ...ampelBewerten(k, jetzt) }));
  const aktiverFilter = FILTER.find((f) => f === filter);
  const gefiltert = aktiverFilter ? alle.filter((x) => x.gruende.includes(aktiverFilter)) : alle;
  const reihenfolge = { rot: 0, gelb: 1, gruen: 2 } as const;
  gefiltert.sort((a, b) => reihenfolge[a.ampel] - reihenfolge[b.ampel] || a.k.firmenname.localeCompare(b.k.firmenname));
  const namen = await ladeNamen(supabase, alle.map((x) => x.k.hauptberater_id));

  return (
    <>
      <Seitenkopf titel={titel} beschreibung="Kunden mit Ampel und Filter nach Handlungsbedarf" />
      <div className="mb-4 flex flex-wrap gap-2">
        <Link
          href={basis}
          className={cn("rounded-full border px-3 py-1 text-sm", !aktiverFilter ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
        >
          Alle ({alle.length})
        </Link>
        {FILTER.map((f) => (
          <Link
            key={f}
            href={`${basis}?filter=${f}`}
            className={cn("rounded-full border px-3 py-1 text-sm", aktiverFilter === f ? "bg-primary text-primary-foreground" : "hover:bg-accent")}
          >
            {AMPEL_GRUND_LABEL[f]} ({alle.filter((x) => x.gruende.includes(f)).length})
          </Link>
        ))}
      </div>
      <Card>
        <CardContent>
          {gefiltert.length === 0 ? (
            <Leer>Keine Kunden für diesen Filter.</Leer>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Ampel</TableHead>
                  <TableHead>Kunde</TableHead>
                  <TableHead>Hauptberater</TableHead>
                  <TableHead className="text-right">Rest</TableHead>
                  <TableHead>Letzte Aktivität</TableHead>
                  <TableHead>Beim Kunden seit</TableHead>
                  <TableHead>Hinweise</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {gefiltert.map(({ k, ampel, gruende }) => (
                  <TableRow key={k.customer_id}>
                    <TableCell>
                      <Ampel wert={ampel} />
                    </TableCell>
                    <TableCell>
                      <Link href={`/k/${k.customer_id}`} className="font-medium hover:underline">
                        {k.firmenname}
                      </Link>
                    </TableCell>
                    <TableCell>{k.hauptberater_id ? namen.get(k.hauptberater_id) : "–"}</TableCell>
                    <TableCell className={cn("text-right tabular-nums", Number(k.rest) < 0 && "text-destructive")}>
                      {k.rest_prozent === null ? "–" : `${formatZahl(k.rest_prozent, 0)} %`}
                    </TableCell>
                    <TableCell>{formatDatum(k.letzte_aktivitaet)}</TableCell>
                    <TableCell>{k.wartet_beim_kunden_seit ? formatDatum(k.wartet_beim_kunden_seit) : "–"}</TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        {gruende.map((g) => (
                          <Badge key={g} variant={g === "restkontingent" ? "danger" : "warning"}>
                            {AMPEL_GRUND_LABEL[g]}
                          </Badge>
                        ))}
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
