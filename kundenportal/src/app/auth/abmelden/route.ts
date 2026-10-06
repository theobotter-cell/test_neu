import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function abmelden(request: NextRequest) {
  const supabase = await createClient();
  await supabase.auth.signOut();
  const ziel = request.nextUrl.clone();
  ziel.pathname = "/login";
  ziel.search = "";
  ziel.searchParams.set("hinweis", request.nextUrl.searchParams.get("grund") === "deaktiviert" ? "deaktiviert" : "abgemeldet");
  return NextResponse.redirect(ziel, { status: 303 });
}

export const GET = abmelden;
export const POST = abmelden;
