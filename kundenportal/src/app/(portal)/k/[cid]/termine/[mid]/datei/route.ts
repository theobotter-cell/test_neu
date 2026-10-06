import { NextResponse, type NextRequest } from "next/server";
import { ladeSitzung } from "@/lib/auth";
import { TRANSKRIPT_BUCKET } from "@/lib/config";

/**
 * Download eines Transkripts. Datei: kurzlebige signierte URL, erzeugt im
 * Kontext des Nutzers – Storage-RLS entscheidet über den Zugriff.
 * ?text=1 liefert das Text-Transkript als .txt.
 */
export async function GET(request: NextRequest, { params }: { params: Promise<{ cid: string; mid: string }> }) {
  const { cid, mid } = await params;
  const s = await ladeSitzung();
  if (!s?.profil?.aktiv) return NextResponse.json({ fehler: "Nicht angemeldet" }, { status: 401 });

  const { data: termin } = await s.supabase
    .from("meetings")
    .select("titel, datum, transkript, transkript_datei")
    .eq("id", mid)
    .eq("customer_id", cid)
    .maybeSingle();
  if (!termin) return NextResponse.json({ fehler: "Nicht gefunden" }, { status: 404 });

  if (request.nextUrl.searchParams.get("text")) {
    if (!termin.transkript) return NextResponse.json({ fehler: "Kein Transkript" }, { status: 404 });
    const name = `Transkript_${termin.datum}_${termin.titel}`.replace(/[^\w.\-]+/g, "_");
    return new Response(termin.transkript, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${name}.txt"`,
        "Cache-Control": "no-store",
      },
    });
  }

  if (!termin.transkript_datei) return NextResponse.json({ fehler: "Keine Datei" }, { status: 404 });
  const { data, error } = await s.supabase.storage
    .from(TRANSKRIPT_BUCKET)
    .createSignedUrl(termin.transkript_datei, 60, { download: termin.transkript_datei.split("/").pop()?.replace(/^\d+-/, "") });
  if (error || !data) return NextResponse.json({ fehler: "Datei nicht verfügbar" }, { status: 404 });
  return NextResponse.redirect(data.signedUrl);
}
