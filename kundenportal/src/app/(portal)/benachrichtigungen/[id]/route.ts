import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sicheresZiel } from "@/lib/weiterleitung";

/** Markiert eine Benachrichtigung als gelesen und öffnet das verknüpfte Objekt */
export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const { data } = await supabase.from("notifications").update({ gelesen: true }).eq("id", id).select("link").maybeSingle();
  const ziel = request.nextUrl.clone();
  ziel.pathname = sicheresZiel(data?.link, "/benachrichtigungen");
  ziel.search = "";
  return NextResponse.redirect(ziel);
}
