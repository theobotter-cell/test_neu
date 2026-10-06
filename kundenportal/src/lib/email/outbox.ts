import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { appUrl } from "@/lib/config";
import { benachrichtigungsMail } from "./vorlagen";
import type { MailProvider } from "./provider";

const MAX_VERSUCHE = 5;

type OutboxZeile = {
  id: string;
  typ: string;
  betreff: string;
  text: string;
  link: string | null;
  html: string | null;
  versuche: number;
  profiles: { email: string; name: string; aktiv: boolean } | null;
};

/**
 * Versendet offene E-Mails aus public.email_outbox (befüllt von DB-Triggern).
 * Jede Zeile wird vor dem Versand per bedingtem Update "beansprucht", damit
 * parallele Läufe keine Doppelversände erzeugen.
 */
export async function outboxVerarbeiten(admin: SupabaseClient, provider: MailProvider, limit = 50) {
  const { data, error } = await admin
    .from("email_outbox")
    .select("id, typ, betreff, text, link, html, versuche, profiles(email, name, aktiv)")
    .eq("status", "offen")
    .lt("versuche", MAX_VERSUCHE)
    .order("created_at")
    .limit(limit);
  if (error) throw new Error(`Outbox nicht lesbar: ${error.message}`);

  const ergebnis = { gesendet: 0, fehler: 0, uebersprungen: 0 };
  for (const zeile of (data ?? []) as unknown as OutboxZeile[]) {
    // Beanspruchen: nur wenn noch niemand anderes den Versuch gezählt hat
    const { data: beansprucht } = await admin
      .from("email_outbox")
      .update({ versuche: zeile.versuche + 1 })
      .eq("id", zeile.id)
      .eq("status", "offen")
      .eq("versuche", zeile.versuche)
      .select("id");
    if (!beansprucht?.length) continue;

    const empfaenger = zeile.profiles;
    if (!empfaenger?.aktiv || !empfaenger.email) {
      await admin.from("email_outbox").update({ status: "uebersprungen" }).eq("id", zeile.id);
      ergebnis.uebersprungen++;
      continue;
    }

    const link = zeile.link ? `${appUrl()}${zeile.link}` : null;
    const inhalt = zeile.html
      ? { html: zeile.html, text: zeile.text }
      : benachrichtigungsMail({ name: empfaenger.name, text: zeile.text, link });

    try {
      await provider.senden({ an: empfaenger.email, betreff: zeile.betreff, ...inhalt });
      await admin.from("email_outbox").update({ status: "gesendet", gesendet_am: new Date().toISOString(), fehler: null }).eq("id", zeile.id);
      ergebnis.gesendet++;
    } catch (e) {
      const endgueltig = zeile.versuche + 1 >= MAX_VERSUCHE;
      await admin
        .from("email_outbox")
        .update({ status: endgueltig ? "fehler" : "offen", fehler: (e as Error).message.slice(0, 500) })
        .eq("id", zeile.id);
      ergebnis.fehler++;
    }
  }
  return ergebnis;
}
