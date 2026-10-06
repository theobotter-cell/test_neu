import { NextResponse, type NextRequest } from "next/server";
import { ladeSitzung } from "@/lib/auth";
import { ladeNamen } from "@/lib/daten";
import { ladeZeiten } from "@/lib/zeiten";
import { csvAntwort, csvErzeugen, type CsvWert } from "@/lib/csv";
import { formatDatum, monatsGrenzen } from "@/lib/format";
import { KATEGORIE_LABEL } from "@/lib/workflow";

/** CSV-Export eines abgeschlossenen Monats für die Rechnungsstellung (nur intern) */
export async function GET(request: NextRequest, { params }: { params: Promise<{ cid: string }> }) {
  const { cid } = await params;
  const monat = request.nextUrl.searchParams.get("monat") ?? "";
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(monat)) return NextResponse.json({ fehler: "Ungültiger Monat" }, { status: 400 });

  const s = await ladeSitzung();
  if (!s?.profil?.aktiv) return NextResponse.json({ fehler: "Nicht angemeldet" }, { status: 401 });

  // Monatsabschlüsse sind per RLS nur für admin und zugeordnete Berater sichtbar
  const { data: abschluss } = await s.supabase
    .from("monatsabschluesse")
    .select("status, customers(firmenname, bitrix_company_id)")
    .eq("customer_id", cid)
    .eq("monat", monat)
    .maybeSingle();
  if (!abschluss || abschluss.status !== "abgeschlossen") {
    return NextResponse.json({ fehler: "Monat ist nicht abgeschlossen oder nicht zugänglich" }, { status: 404 });
  }
  const kunde = abschluss.customers as unknown as { firmenname: string; bitrix_company_id: string | null };

  const zeiten = await ladeZeiten(s.supabase, cid, monatsGrenzen(monat));
  zeiten.sort((a, b) => a.datum.localeCompare(b.datum));
  const namen = await ladeNamen(s.supabase, zeiten.map((z) => z.erfasst_von));
  const summe = (f: (z: (typeof zeiten)[number]) => boolean) =>
    Math.round(zeiten.filter(f).reduce((x, z) => x + Number(z.dauer_stunden), 0) * 100) / 100;

  const zeilen: CsvWert[][] = zeiten.map((z) => [
    kunde.firmenname,
    kunde.bitrix_company_id ?? "",
    monat,
    formatDatum(z.datum),
    KATEGORIE_LABEL[z.kategorie],
    z.beschreibung,
    z.story_titel ?? "",
    z.ticket_titel ?? "",
    z.erfasst_von ? (namen.get(z.erfasst_von) ?? "") : "",
    z.bitrix_task_id ?? "",
    z.abrechenbar,
    Number(z.dauer_stunden),
  ]);
  zeilen.push([]);
  zeilen.push(["Summe Beratung (abrechenbar)", "", "", "", "", "", "", "", "", "", "", summe((z) => z.abrechenbar && z.kategorie === "beratung")]);
  zeilen.push(["Summe Entwicklung (abrechenbar)", "", "", "", "", "", "", "", "", "", "", summe((z) => z.abrechenbar && z.kategorie === "entwicklung")]);
  zeilen.push(["Summe abrechenbar", "", "", "", "", "", "", "", "", "", "", summe((z) => z.abrechenbar)]);

  const csv = csvErzeugen(
    ["Kunde", "Bitrix-Firma", "Monat", "Datum", "Kategorie", "Beschreibung", "Story", "Ticket", "Person", "Bitrix-Aufgabe", "Abrechenbar", "Stunden"],
    zeilen,
  );
  return csvAntwort(csv, `Abrechnung_${kunde.firmenname}_${monat}.csv`);
}
