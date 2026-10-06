import type { Metadata } from "next";
import { Download } from "lucide-react";
import { ladeKundenKontext } from "@/lib/auth";
import { ladeNamen } from "@/lib/daten";
import { filterLesen, ladeZeiten } from "@/lib/zeiten";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Button, buttonVariants } from "@/components/ui/button";
import { Seitenkopf, Leer } from "@/components/seitenkopf";
import { Feld } from "@/components/feld";
import { ZeitenTabelle } from "@/components/zeiten-tabelle";
import { ZeitFormular } from "@/components/zeit-formular";
import { zeitAnlegen } from "@/lib/aktionen/zeiten";
import { formatStunden, heuteIso } from "@/lib/format";

export const metadata: Metadata = { title: "Zeiten" };

export default async function ZeitenSeite({
  params,
  searchParams,
}: {
  params: Promise<{ cid: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { cid } = await params;
  const filter = filterLesen(await searchParams);
  const ctx = await ladeKundenKontext(cid);
  const { supabase } = ctx;
  const basis = `/k/${cid}`;

  const [zeiten, abschluesse, stories, tickets] = await Promise.all([
    ladeZeiten(supabase, cid, filter),
    ctx.darfBearbeiten
      ? supabase.from("monatsabschluesse").select("monat").eq("customer_id", cid).eq("status", "abgeschlossen")
      : Promise.resolve({ data: [] as { monat: string }[] }),
    ctx.darfBearbeiten
      ? supabase.from("stories").select("id, customer_id, titel").eq("customer_id", cid).neq("status", "abgenommen").order("titel")
      : Promise.resolve({ data: [] }),
    ctx.darfBearbeiten
      ? supabase.from("tickets").select("id, customer_id, titel").eq("customer_id", cid).neq("status", "erledigt").order("titel")
      : Promise.resolve({ data: [] }),
  ]);
  const namen = await ladeNamen(supabase, zeiten.map((z) => z.erfasst_von));
  const gesperrt = new Set((abschluesse.data ?? []).map((a) => a.monat));
  const summe = (k: string) => zeiten.filter((z) => z.kategorie === k).reduce((s, z) => s + Number(z.dauer_stunden), 0);

  const exportParams = new URLSearchParams();
  if (filter.von) exportParams.set("von", filter.von);
  if (filter.bis) exportParams.set("bis", filter.bis);
  if (filter.kategorie) exportParams.set("kategorie", filter.kategorie);

  return (
    <>
      <Seitenkopf
        titel="Zeiten"
        beschreibung={`Beratung ${formatStunden(summe("beratung"))} · Entwicklung ${formatStunden(summe("entwicklung"))} im gewählten Zeitraum`}
        aktionen={
          <a href={`${basis}/zeiten/export?${exportParams.toString()}`} className={buttonVariants({ variant: "outline" })}>
            <Download /> CSV-Export
          </a>
        }
      />

      {ctx.darfBearbeiten && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Zeit erfassen</CardTitle>
          </CardHeader>
          <CardContent>
            <ZeitFormular
              aktion={zeitAnlegen}
              kunden={[{ id: cid, firmenname: ctx.kunde.firmenname }]}
              stories={stories.data ?? []}
              tickets={tickets.data ?? []}
              heute={heuteIso()}
            />
          </CardContent>
        </Card>
      )}

      <Card>
        <CardContent>
          <form className="mb-4 grid gap-3 sm:grid-cols-4 sm:items-end" method="get">
            <Feld label="Von" htmlFor="von">
              <Input id="von" name="von" type="date" defaultValue={filter.von} />
            </Feld>
            <Feld label="Bis" htmlFor="bis">
              <Input id="bis" name="bis" type="date" defaultValue={filter.bis} />
            </Feld>
            <Feld label="Kategorie" htmlFor="kategorie">
              <Select id="kategorie" name="kategorie" defaultValue={filter.kategorie ?? ""}>
                <option value="">Alle</option>
                <option value="beratung">Beratung</option>
                <option value="entwicklung">Entwicklung</option>
              </Select>
            </Feld>
            <div className="flex gap-2">
              <Button type="submit" variant="secondary">
                Filtern
              </Button>
              <a href={`${basis}/zeiten`} className={buttonVariants({ variant: "ghost" })}>
                Zurücksetzen
              </a>
            </div>
          </form>
          {zeiten.length === 0 ? (
            <Leer>Keine Zeiten im gewählten Zeitraum.</Leer>
          ) : (
            <ZeitenTabelle
              zeiten={zeiten}
              namen={namen}
              istKunde={!ctx.intern}
              basis={basis}
              bearbeitenLink={
                ctx.darfBearbeiten
                  ? (z) => (gesperrt.has(z.datum.slice(0, 7)) ? null : `${basis}/zeiten/${z.id}`)
                  : undefined
              }
            />
          )}
        </CardContent>
      </Card>
    </>
  );
}
