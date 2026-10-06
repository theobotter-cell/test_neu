import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Download } from "lucide-react";
import { ladeKundenKontext } from "@/lib/auth";
import { ladeBerater, ladeNamen } from "@/lib/daten";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Seitenkopf } from "@/components/seitenkopf";
import { AktionForm } from "@/components/aktion-form";
import { AbsendenButton } from "@/components/absenden-button";
import { LoeschenButton } from "@/components/loeschen-button";
import { TerminFelder } from "@/components/termin-felder";
import { terminAktualisieren, terminLoeschen } from "@/lib/aktionen/termine";
import { formatDatum, heuteIso } from "@/lib/format";
import type { Termin } from "@/lib/types";

export const metadata: Metadata = { title: "Termin" };

export default async function TerminDetail({ params }: { params: Promise<{ cid: string; mid: string }> }) {
  const { cid, mid } = await params;
  const ctx = await ladeKundenKontext(cid);
  const { data: termin } = await ctx.supabase.from("meetings").select("*").eq("id", mid).eq("customer_id", cid).maybeSingle<Termin>();
  if (!termin) notFound();
  const [namen, berater] = await Promise.all([
    ladeNamen(ctx.supabase, [termin.berater_id]),
    ctx.darfBearbeiten ? ladeBerater(ctx.supabase) : Promise.resolve([]),
  ]);
  const dateiname = termin.transkript_datei?.split("/").pop()?.replace(/^\d+-/, "");

  return (
    <>
      <Seitenkopf
        titel={termin.titel}
        beschreibung={`${formatDatum(termin.datum)}${termin.berater_id ? ` · ${namen.get(termin.berater_id) ?? ""}` : ""}`}
        aktionen={
          <>
            {termin.transkript && (
              <a href={`/k/${cid}/termine/${mid}/datei?text=1`} className={buttonVariants({ variant: "outline" })}>
                <Download /> Transkript (.txt)
              </a>
            )}
            {termin.transkript_datei && (
              <a href={`/k/${cid}/termine/${mid}/datei`} className={buttonVariants({ variant: "outline" })}>
                <Download /> {dateiname ?? "Datei"}
              </a>
            )}
            <Link href={`/k/${cid}/termine`} className="self-center text-sm text-muted-foreground hover:underline">
              Alle Termine
            </Link>
          </>
        }
      />
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Transkript</CardTitle>
        </CardHeader>
        <CardContent>
          {termin.transkript ? (
            <div className="max-h-[60vh] overflow-y-auto rounded-lg bg-muted/50 p-4 text-sm leading-relaxed whitespace-pre-wrap">
              {termin.transkript}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              {termin.transkript_datei ? "Das Transkript liegt als Datei vor (siehe Download oben)." : "Kein Transkript hinterlegt."}
            </p>
          )}
        </CardContent>
      </Card>
      {ctx.darfBearbeiten && (
        <Card>
          <CardHeader>
            <CardTitle>Termin bearbeiten</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <AktionForm aktion={terminAktualisieren.bind(null, mid)} className="grid gap-4">
              <TerminFelder termin={termin} berater={berater} heute={heuteIso()} />
              <AbsendenButton className="justify-self-start">Speichern</AbsendenButton>
            </AktionForm>
            <div className="border-t pt-4">
              <LoeschenButton aktion={terminLoeschen.bind(null, mid)} bestaetigung="Termin inkl. Transkript löschen?" label="Termin löschen" />
            </div>
          </CardContent>
        </Card>
      )}
    </>
  );
}
