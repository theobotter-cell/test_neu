import Link from "next/link";
import type { Metadata } from "next";
import { FileText } from "lucide-react";
import { ladeKundenKontext } from "@/lib/auth";
import { ladeBerater, ladeNamen } from "@/lib/daten";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Seitenkopf, Leer } from "@/components/seitenkopf";
import { AktionForm } from "@/components/aktion-form";
import { AbsendenButton } from "@/components/absenden-button";
import { TerminFelder } from "@/components/termin-felder";
import { terminAnlegen } from "@/lib/aktionen/termine";
import { formatDatum, heuteIso } from "@/lib/format";
import type { Termin } from "@/lib/types";

export const metadata: Metadata = { title: "Termine" };

export default async function TermineSeite({ params }: { params: Promise<{ cid: string }> }) {
  const { cid } = await params;
  const ctx = await ladeKundenKontext(cid);
  const { data } = await ctx.supabase
    .from("meetings")
    .select("id, datum, titel, berater_id, transkript_datei, transkript")
    .eq("customer_id", cid)
    .order("datum", { ascending: false });
  const termine = (data ?? []) as Termin[];
  const [namen, berater] = await Promise.all([
    ladeNamen(ctx.supabase, termine.map((t) => t.berater_id)),
    ctx.darfBearbeiten ? ladeBerater(ctx.supabase) : Promise.resolve([]),
  ]);

  return (
    <>
      <Seitenkopf titel="Termine" beschreibung="Vergangene Termine mit Transkripten" />
      {ctx.darfBearbeiten && (
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>Termin dokumentieren</CardTitle>
          </CardHeader>
          <CardContent>
            <AktionForm aktion={terminAnlegen.bind(null, cid)} className="grid gap-4">
              <TerminFelder berater={berater} standardBerater={ctx.profil.id} heute={heuteIso()} />
              <AbsendenButton className="justify-self-start">Termin speichern</AbsendenButton>
            </AktionForm>
          </CardContent>
        </Card>
      )}
      {termine.length === 0 ? (
        <Leer>Noch keine Termine dokumentiert.</Leer>
      ) : (
        <ol className="space-y-3">
          {termine.map((t) => (
            <li key={t.id}>
              <Link href={`/k/${cid}/termine/${t.id}`} className="block rounded-xl border bg-card p-4 transition-colors hover:bg-accent">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="font-medium">{t.titel}</span>
                  <span className="text-sm text-muted-foreground tabular-nums">{formatDatum(t.datum)}</span>
                </div>
                <div className="mt-1 flex flex-wrap gap-3 text-xs text-muted-foreground">
                  {t.berater_id && <span>{namen.get(t.berater_id)}</span>}
                  {t.transkript && <span>Transkript</span>}
                  {t.transkript_datei && (
                    <span className="inline-flex items-center gap-1">
                      <FileText className="size-3" /> Datei
                    </span>
                  )}
                </div>
              </Link>
            </li>
          ))}
        </ol>
      )}
    </>
  );
}
