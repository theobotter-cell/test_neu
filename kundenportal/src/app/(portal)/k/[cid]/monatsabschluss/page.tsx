import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AlertTriangle, CheckCircle2, Download, Lock } from "lucide-react";
import { ladeKundenKontext } from "@/lib/auth";
import { ladeNamen } from "@/lib/daten";
import { ladeZeiten } from "@/lib/zeiten";
import { monatPruefen } from "@/lib/monatspruefung";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Seitenkopf, Leer } from "@/components/seitenkopf";
import { ZeitenTabelle } from "@/components/zeiten-tabelle";
import { AktionButton } from "@/components/aktion-button";
import { AktionForm } from "@/components/aktion-form";
import { AbsendenButton } from "@/components/absenden-button";
import { monatAbschliessen, monatWiedereroeffnen } from "@/lib/aktionen/monatsabschluss";
import { formatDatumZeit, formatMonat, formatStunden, monatsGrenzen, vormonat } from "@/lib/format";
import type { Monatsabschluss } from "@/lib/types";

export const metadata: Metadata = { title: "Monatsabschluss" };

export default async function MonatsabschlussSeite({
  params,
  searchParams,
}: {
  params: Promise<{ cid: string }>;
  searchParams: Promise<{ monat?: string }>;
}) {
  const { cid } = await params;
  const sp = await searchParams;
  const ctx = await ladeKundenKontext(cid);
  // Rein intern: nur admin und zugeordnete Berater
  if (!ctx.darfBearbeiten) notFound();
  const monat = sp.monat && /^\d{4}-(0[1-9]|1[0-2])$/.test(sp.monat) ? sp.monat : vormonat();
  const { von, bis } = monatsGrenzen(monat);
  const basis = `/k/${cid}`;

  const [zeiten, abschlussRes, verlaufRes] = await Promise.all([
    ladeZeiten(ctx.supabase, cid, { von, bis }),
    ctx.supabase.from("monatsabschluesse").select("*").eq("customer_id", cid).eq("monat", monat).maybeSingle<Monatsabschluss>(),
    ctx.supabase.from("monatsabschluesse").select("*").eq("customer_id", cid).order("monat", { ascending: false }).limit(12),
  ]);
  const abschluss = abschlussRes.data;
  const abgeschlossen = abschluss?.status === "abgeschlossen";
  const namen = await ladeNamen(ctx.supabase, [...zeiten.map((z) => z.erfasst_von), abschluss?.abgeschlossen_von]);
  const hinweise = monatPruefen(zeiten);
  const markiert = new Set(hinweise.flatMap((h) => h.zeitIds));
  const summe = (f: (z: (typeof zeiten)[number]) => boolean) => zeiten.filter(f).reduce((s, z) => s + Number(z.dauer_stunden), 0);

  return (
    <>
      <Seitenkopf
        titel={`Monatsabschluss ${formatMonat(monat)}`}
        beschreibung="Interne Prüfung vor der Rechnungsstellung – für den Kunden nicht sichtbar."
        aktionen={
          <form method="get" className="flex gap-2">
            <Input type="month" name="monat" defaultValue={monat} aria-label="Monat" className="w-44" />
            <Button type="submit" variant="secondary">
              Anzeigen
            </Button>
          </form>
        }
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Status
              {abgeschlossen ? (
                <Badge variant="success">
                  <Lock className="mr-1 size-3" /> abgeschlossen
                </Badge>
              ) : (
                <Badge variant="outline">offen</Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <dl className="grid grid-cols-2 gap-4 text-sm sm:grid-cols-4">
              <div>
                <dt className="text-muted-foreground">Beratung (abr.)</dt>
                <dd className="text-lg font-semibold">{formatStunden(summe((z) => z.abrechenbar && z.kategorie === "beratung"))}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Entwicklung (abr.)</dt>
                <dd className="text-lg font-semibold">{formatStunden(summe((z) => z.abrechenbar && z.kategorie === "entwicklung"))}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Nicht abrechenbar</dt>
                <dd className="text-lg font-semibold">{formatStunden(summe((z) => !z.abrechenbar))}</dd>
              </div>
              <div>
                <dt className="text-muted-foreground">Einträge</dt>
                <dd className="text-lg font-semibold">{zeiten.length}</dd>
              </div>
            </dl>
            {abgeschlossen ? (
              <>
                <p className="text-sm text-muted-foreground">
                  Abgeschlossen von {(abschluss?.abgeschlossen_von && namen.get(abschluss.abgeschlossen_von)) ?? "–"} am{" "}
                  {formatDatumZeit(abschluss?.abgeschlossen_am)}. Die Zeiten dieses Monats sind gesperrt.
                </p>
                <a href={`${basis}/monatsabschluss/export?monat=${monat}`} className={buttonVariants()}>
                  <Download /> CSV für Rechnungsstellung
                </a>
              </>
            ) : (
              <AktionButton
                aktion={monatAbschliessen.bind(null, cid, monat)}
                variant="default"
                size="default"
                bestaetigung={`${formatMonat(monat)} abschließen? Danach sind alle Zeiten dieses Monats gesperrt.`}
              >
                Monat abschließen
              </AktionButton>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Prüfhinweise</CardTitle>
          </CardHeader>
          <CardContent>
            {hinweise.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-success">
                <CheckCircle2 className="size-4" /> Keine Auffälligkeiten.
              </p>
            ) : (
              <ul className="space-y-2 text-sm">
                {hinweise.map((h, i) => (
                  <li key={i} className="flex gap-2">
                    <AlertTriangle className="mt-0.5 size-4 shrink-0 text-amber-600" />
                    {h.text}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {abgeschlossen && ctx.profil.rolle === "admin" && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Monat wieder öffnen</CardTitle>
          </CardHeader>
          <CardContent>
            <AktionForm aktion={monatWiedereroeffnen.bind(null, cid, monat)} className="grid max-w-xl gap-3">
              <Textarea name="grund" placeholder="Grund (wird im Audit-Log protokolliert)" required rows={2} aria-label="Grund" />
              <AbsendenButton variant="outline" className="justify-self-start" bestaetigung="Monat wirklich wieder öffnen?">
                Wieder öffnen
              </AbsendenButton>
            </AktionForm>
          </CardContent>
        </Card>
      )}

      <Card className="mt-6">
        <CardHeader>
          <CardTitle>Zeiten im {formatMonat(monat)}</CardTitle>
        </CardHeader>
        <CardContent>
          {hinweise.length > 0 && (
            <Alert variant="warning" className="mb-4">
              Markierte Zeilen haben Prüfhinweise.
            </Alert>
          )}
          {zeiten.length === 0 ? (
            <Leer>Keine Zeiten in diesem Monat.</Leer>
          ) : (
            <ZeitenTabelle
              zeiten={zeiten}
              namen={namen}
              istKunde={false}
              basis={basis}
              hervorheben={markiert}
              bearbeitenLink={abgeschlossen ? undefined : (z) => `${basis}/zeiten/${z.id}`}
            />
          )}
        </CardContent>
      </Card>

      {(verlaufRes.data ?? []).length > 0 && (
        <Card className="mt-6">
          <CardHeader>
            <CardTitle>Bisherige Abschlüsse</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-wrap gap-2 text-sm">
              {((verlaufRes.data ?? []) as Monatsabschluss[]).map((m) => (
                <li key={m.id}>
                  <a href={`${basis}/monatsabschluss?monat=${m.monat}`} className="inline-flex items-center gap-1 rounded-full border px-3 py-1 hover:bg-accent">
                    {m.status === "abgeschlossen" && <Lock className="size-3" />}
                    {formatMonat(m.monat)}
                  </a>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}
    </>
  );
}
