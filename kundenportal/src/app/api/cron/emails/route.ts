import { NextResponse } from "next/server";
import { cronErlaubt } from "@/lib/cron";
import { createAdminClient } from "@/lib/supabase/admin";
import { mailProvider } from "@/lib/email/provider";
import { outboxVerarbeiten } from "@/lib/email/outbox";

export const dynamic = "force-dynamic";

/** Versendet die von Datenbank-Triggern erzeugten E-Mails (alle 5 Minuten) */
export async function GET(request: Request) {
  if (!cronErlaubt(request)) return NextResponse.json({ fehler: "Nicht autorisiert" }, { status: 401 });
  const ergebnis = await outboxVerarbeiten(createAdminClient(), mailProvider());
  return NextResponse.json(ergebnis);
}
