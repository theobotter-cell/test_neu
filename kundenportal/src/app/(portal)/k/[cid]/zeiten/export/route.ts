import { NextResponse, type NextRequest } from "next/server";
import { ladeSitzung } from "@/lib/auth";
import { ladeNamen } from "@/lib/daten";
import { filterLesen, ladeZeiten } from "@/lib/zeiten";
import { csvAntwort, csvErzeugen } from "@/lib/csv";
import { formatDatum } from "@/lib/format";
import { KATEGORIE_LABEL } from "@/lib/workflow";

/** CSV-Export der Zeiten (Kunde und Berater), Filter: von, bis, kategorie */
export async function GET(request: NextRequest, { params }: { params: Promise<{ cid: string }> }) {
  const { cid } = await params;
  const s = await ladeSitzung();
  if (!s?.profil?.aktiv) return NextResponse.json({ fehler: "Nicht angemeldet" }, { status: 401 });
  const { supabase, profil } = s;

  // RLS: liefert nur zugängliche Kunden
  const { data: kunde } = await supabase.from("customers").select("id, firmenname").eq("id", cid).maybeSingle();
  if (!kunde) return NextResponse.json({ fehler: "Nicht gefunden" }, { status: 404 });

  const filter = filterLesen(Object.fromEntries(request.nextUrl.searchParams));
  const zeiten = await ladeZeiten(supabase, cid, filter);
  const namen = await ladeNamen(supabase, zeiten.map((z) => z.erfasst_von));
  const istKunde = profil.rolle === "kunde";

  const csv = csvErzeugen(
    ["Datum", "Dauer (h)", "Kategorie", "Beschreibung", "Story", "Ticket", "Person", "Abrechenbar"],
    zeiten.map((z) => [
      formatDatum(z.datum),
      Number(z.dauer_stunden),
      KATEGORIE_LABEL[z.kategorie],
      z.beschreibung,
      z.story_titel ?? "",
      z.ticket_titel ?? "",
      // Kunde: Personenname nur bei Beratung
      z.erfasst_von && (!istKunde || z.kategorie === "beratung") ? (namen.get(z.erfasst_von) ?? "") : "",
      z.abrechenbar,
    ]),
  );
  const zeitraum = [filter.von, filter.bis].filter(Boolean).join("_bis_") || "alle";
  return csvAntwort(csv, `Zeiten_${kunde.firmenname}_${zeitraum}.csv`);
}
