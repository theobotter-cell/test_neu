import Link from "next/link";
import type { Metadata } from "next";
import { ladeKundenKontext } from "@/lib/auth";
import { ladeKontingentStand } from "@/lib/daten";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Seitenkopf, Leer } from "@/components/seitenkopf";
import { KontingentBalken } from "@/components/kontingent-balken";
import { AktionForm } from "@/components/aktion-form";
import { AbsendenButton } from "@/components/absenden-button";
import { LoeschenButton } from "@/components/loeschen-button";
import { Feld } from "@/components/feld";
import { kontingentAktualisieren, kontingentAnlegen, kontingentLoeschen } from "@/lib/aktionen/kontingente";
import { formatDatum, formatEuro, formatStunden, formatZahl, heuteIso } from "@/lib/format";
import type { Kontingent } from "@/lib/types";

export const metadata: Metadata = { title: "Leistungen" };

function KontingentFelder({ k }: { k?: Kontingent }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
      <Feld label="Leistung" htmlFor="leistung" className="lg:col-span-2">
        <Input id="leistung" name="leistung" defaultValue={k?.leistung} placeholder="Supportpaket 20 h" required />
      </Feld>
      <Feld label="Gebucht am" htmlFor="gebucht_am">
        <Input id="gebucht_am" name="gebucht_am" type="date" defaultValue={k?.gebucht_am ?? heuteIso()} required />
      </Feld>
      <Feld label="Stunden" htmlFor="stunden">
        <Input id="stunden" name="stunden" inputMode="decimal" defaultValue={k ? formatZahl(k.stunden) : ""} required />
      </Feld>
      <Feld label="Betrag € (optional)" htmlFor="betrag">
        <Input id="betrag" name="betrag" inputMode="decimal" defaultValue={k?.betrag ? formatZahl(k.betrag) : ""} />
      </Feld>
      <Feld label="Bitrix-Deal-ID (optional)" htmlFor="bitrix_deal_id">
        <Input id="bitrix_deal_id" name="bitrix_deal_id" defaultValue={k?.bitrix_deal_id ?? ""} />
      </Feld>
    </div>
  );
}

export default async function KontingenteSeite({
  params,
  searchParams,
}: {
  params: Promise<{ cid: string }>;
  searchParams: Promise<{ bearbeiten?: string }>;
}) {
  const { cid } = await params;
  const { bearbeiten } = await searchParams;
  const ctx = await ladeKundenKontext(cid);
  const [stand, { data }] = await Promise.all([
    ladeKontingentStand(ctx.supabase, cid),
    ctx.supabase.from("kontingente").select("*").eq("customer_id", cid).order("gebucht_am", { ascending: false }),
  ]);
  const kontingente = (data ?? []) as Kontingent[];
  const inBearbeitung = ctx.darfBearbeiten ? kontingente.find((k) => k.id === bearbeiten) : undefined;

  return (
    <>
      <Seitenkopf titel="Gebuchte Leistungen" beschreibung="Kontingente werden aufaddiert und verfallen nicht." />
      <Card className="mb-6">
        <CardContent>
          <KontingentBalken stand={stand} />
        </CardContent>
      </Card>

      {ctx.darfBearbeiten && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>{inBearbeitung ? "Leistung bearbeiten" : "Leistung hinzufügen"}</CardTitle>
          </CardHeader>
          <CardContent>
            <AktionForm
              key={inBearbeitung?.id ?? "neu"}
              aktion={inBearbeitung ? kontingentAktualisieren.bind(null, inBearbeitung.id) : kontingentAnlegen.bind(null, cid)}
              zuruecksetzen={!inBearbeitung}
              className="grid gap-4"
            >
              <KontingentFelder k={inBearbeitung} />
              <div className="flex gap-2">
                <AbsendenButton>{inBearbeitung ? "Speichern" : "Hinzufügen"}</AbsendenButton>
                {inBearbeitung && (
                  <Link href={`/k/${cid}/kontingente`} className="self-center text-sm text-muted-foreground hover:underline">
                    Abbrechen
                  </Link>
                )}
              </div>
            </AktionForm>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          {kontingente.length === 0 ? (
            <Leer>Noch keine Leistungen gebucht.</Leer>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Leistung</TableHead>
                  <TableHead>Gebucht am</TableHead>
                  <TableHead className="text-right">Stunden</TableHead>
                  <TableHead className="text-right">Betrag</TableHead>
                  {ctx.intern && <TableHead>Bitrix-Deal</TableHead>}
                  {ctx.darfBearbeiten && <TableHead />}
                </TableRow>
              </TableHeader>
              <TableBody>
                {kontingente.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell className="font-medium">{k.leistung}</TableCell>
                    <TableCell>{formatDatum(k.gebucht_am)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatStunden(k.stunden)}</TableCell>
                    <TableCell className="text-right tabular-nums">{formatEuro(k.betrag)}</TableCell>
                    {ctx.intern && <TableCell>{k.bitrix_deal_id ?? "–"}</TableCell>}
                    {ctx.darfBearbeiten && (
                      <TableCell className="text-right whitespace-nowrap">
                        <Link href={`/k/${cid}/kontingente?bearbeiten=${k.id}`} className="mr-3 text-sm text-primary hover:underline">
                          Bearbeiten
                        </Link>
                        <LoeschenButton aktion={kontingentLoeschen.bind(null, k.id)} bestaetigung={`„${k.leistung}“ löschen?`} />
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
              <TableFooter>
                <TableRow>
                  <TableCell colSpan={2}>Gesamt</TableCell>
                  <TableCell className="text-right tabular-nums">{formatStunden(stand.gesamt)}</TableCell>
                  <TableCell colSpan={ctx.darfBearbeiten ? 3 : ctx.intern ? 2 : 1} />
                </TableRow>
              </TableFooter>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
