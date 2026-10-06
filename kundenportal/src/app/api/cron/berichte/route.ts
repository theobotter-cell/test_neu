import { NextResponse } from "next/server";
import { cronErlaubt } from "@/lib/cron";
import { createAdminClient } from "@/lib/supabase/admin";
import { berichtErzeugen, faelligeZeitraeume } from "@/lib/bericht";
import { berichtDatenLaden } from "@/lib/bericht-laden";
import { heuteIso } from "@/lib/format";

export const dynamic = "force-dynamic";

/**
 * Täglicher Lauf: Montags Wochenberichte, am 1. Monatsberichte. Die Berichte
 * werden in die E-Mail-Warteschlange gestellt (Versand über /api/cron/emails).
 * Optional ?datum=JJJJ-MM-TT zum Nachholen eines Laufs.
 */
export async function GET(request: Request) {
  if (!cronErlaubt(request)) return NextResponse.json({ fehler: "Nicht autorisiert" }, { status: 401 });
  const param = new URL(request.url).searchParams.get("datum");
  const heute = param && /^\d{4}-\d{2}-\d{2}$/.test(param) ? param : heuteIso();
  const admin = createAdminClient();

  let erzeugt = 0;
  for (const z of faelligeZeitraeume(heute)) {
    const { data: kunden } = await admin
      .from("customers")
      .select("id, firmenname, kunde_user_id, profiles!customers_kunde_user_id_fkey(name, aktiv)")
      .eq("bericht_intervall", z.intervall)
      .not("kunde_user_id", "is", null);

    for (const k of kunden ?? []) {
      const login = k.profiles as unknown as { name: string; aktiv: boolean } | null;
      if (!login?.aktiv) continue;
      // Idempotenz: Bericht pro Kunde und Zeitraum nur einmal
      const { error: doppelt } = await admin.from("bericht_versand").insert({ customer_id: k.id, von: z.von, bis: z.bis });
      if (doppelt) continue;

      const daten = await berichtDatenLaden(admin, k, login.name, z.von, z.bis);
      const mail = berichtErzeugen(daten);
      await admin.from("email_outbox").insert({
        user_id: k.kunde_user_id,
        typ: `bericht_${z.intervall}`,
        betreff: mail.betreff,
        text: mail.text,
        html: mail.html,
        link: `/k/${k.id}`,
      });
      erzeugt++;
    }
  }
  return NextResponse.json({ datum: heute, erzeugt });
}
