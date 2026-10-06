import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

const OEFFENTLICH = ["/login", "/passwort-vergessen", "/auth/", "/api/cron/"];

/** Erneuert die Session-Cookies und leitet nicht angemeldete Nutzer zum Login. */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
          Object.entries(headers ?? {}).forEach(([k, v]) => response.headers.set(k, v));
        },
      },
    },
  );

  // Wichtig: getClaims() prüft die Signatur des JWT und erneuert ggf. die Session.
  const { data } = await supabase.auth.getClaims();
  const angemeldet = Boolean(data?.claims?.sub);
  const pfad = request.nextUrl.pathname;

  if (!angemeldet && !OEFFENTLICH.some((p) => pfad === p || pfad.startsWith(p))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pfad !== "/" ? `?weiter=${encodeURIComponent(pfad + request.nextUrl.search)}` : "";
    return NextResponse.redirect(url);
  }
  return response;
}
