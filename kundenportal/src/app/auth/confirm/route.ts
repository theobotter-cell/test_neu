import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { sicheresZiel } from "@/lib/weiterleitung";

/**
 * Ziel der Links aus Einladungs- und Passwort-E-Mails.
 * Unterstützt token_hash (empfohlene E-Mail-Vorlagen) und PKCE-Code.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const code = searchParams.get("code");
  const weiter = sicheresZiel(searchParams.get("weiter"), "/passwort-setzen");

  const supabase = await createClient();
  let ok = false;
  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    ok = !error;
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    ok = !error;
  }

  const ziel = request.nextUrl.clone();
  ziel.search = "";
  if (ok) {
    ziel.pathname = weiter;
  } else {
    ziel.pathname = "/login";
    ziel.searchParams.set("hinweis", "link");
  }
  return NextResponse.redirect(ziel);
}
