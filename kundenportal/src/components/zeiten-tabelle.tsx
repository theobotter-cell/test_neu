import Link from "next/link";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDatum, formatStunden } from "@/lib/format";
import { KATEGORIE_LABEL } from "@/lib/workflow";
import type { Zeit } from "@/lib/types";
import { cn } from "@/lib/utils";

export type ZeitZeile = Zeit & { story_titel?: string | null; ticket_titel?: string | null };

/**
 * Zeitliste. Für Kunden-Logins wird der Personenname nur bei Beratung gezeigt,
 * bei Entwicklung nie (Entwicklerzeiten werden vom Berater übertragen).
 */
export function ZeitenTabelle({
  zeiten,
  namen,
  istKunde,
  basis,
  bearbeitenLink,
  hervorheben,
}: {
  zeiten: ZeitZeile[];
  namen: Map<string, string>;
  istKunde: boolean;
  basis: string;
  bearbeitenLink?: (z: ZeitZeile) => string | null;
  hervorheben?: Set<string>;
}) {
  const summe = zeiten.reduce((s, z) => s + Number(z.dauer_stunden), 0);
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Datum</TableHead>
          <TableHead className="text-right">Dauer</TableHead>
          <TableHead>Kategorie</TableHead>
          <TableHead>Beschreibung</TableHead>
          <TableHead>Bezug</TableHead>
          <TableHead>Person</TableHead>
          {bearbeitenLink && <TableHead />}
        </TableRow>
      </TableHeader>
      <TableBody>
        {zeiten.map((z) => {
          const person = z.erfasst_von && (!istKunde || z.kategorie === "beratung") ? namen.get(z.erfasst_von) : null;
          const link = bearbeitenLink?.(z);
          return (
            <TableRow key={z.id} className={cn(hervorheben?.has(z.id) && "bg-warning/10")}>
              <TableCell className="tabular-nums whitespace-nowrap">{formatDatum(z.datum)}</TableCell>
              <TableCell className="text-right tabular-nums whitespace-nowrap">{formatStunden(z.dauer_stunden)}</TableCell>
              <TableCell>
                <Badge variant={z.kategorie === "beratung" ? "secondary" : "outline"}>{KATEGORIE_LABEL[z.kategorie]}</Badge>
                {!z.abrechenbar && <span className="ml-1 text-xs text-muted-foreground">(nicht abrechenbar)</span>}
              </TableCell>
              <TableCell className="max-w-md">
                {z.beschreibung || <span className="text-muted-foreground italic">ohne Beschreibung</span>}
              </TableCell>
              <TableCell className="text-sm">
                {z.story_id && (
                  <Link href={`${basis}/stories/${z.story_id}`} className="hover:underline">
                    Story: {z.story_titel ?? "öffnen"}
                  </Link>
                )}
                {z.ticket_id && (
                  <Link href={`${basis}/tickets/${z.ticket_id}`} className="block hover:underline">
                    Ticket: {z.ticket_titel ?? "öffnen"}
                  </Link>
                )}
              </TableCell>
              <TableCell className="whitespace-nowrap">{person ?? (istKunde ? "" : "–")}</TableCell>
              {bearbeitenLink && (
                <TableCell>
                  {link && (
                    <Link href={link} className="text-sm text-primary hover:underline">
                      Bearbeiten
                    </Link>
                  )}
                </TableCell>
              )}
            </TableRow>
          );
        })}
      </TableBody>
      <TableFooter>
        <TableRow>
          <TableCell>Summe</TableCell>
          <TableCell className="text-right tabular-nums">{formatStunden(summe)}</TableCell>
          <TableCell colSpan={bearbeitenLink ? 5 : 4} />
        </TableRow>
      </TableFooter>
    </Table>
  );
}
