import Link from "next/link";
import { Bell, LogOut, UserRound } from "lucide-react";
import { sitzungErforderlich } from "@/lib/auth";
import { Navigation, type NavEintrag } from "@/components/navigation";
import { ROLLE_LABEL } from "@/lib/workflow";

export default async function PortalLayout({ children }: { children: React.ReactNode }) {
  const { supabase, profil } = await sitzungErforderlich();

  const { count: ungelesen } = await supabase
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("gelesen", false);

  let eintraege: NavEintrag[];
  if (profil.rolle === "kunde") {
    const { data: kunde } = await supabase.from("customers").select("id").eq("kunde_user_id", profil.id).maybeSingle();
    eintraege = kunde
      ? [
          { href: `/k/${kunde.id}`, label: "Übersicht", exakt: true },
          { href: `/k/${kunde.id}/board`, label: "Board" },
          { href: `/k/${kunde.id}/zeiten`, label: "Zeiten" },
          { href: `/k/${kunde.id}/kontingente`, label: "Leistungen" },
          { href: `/k/${kunde.id}/termine`, label: "Termine" },
        ]
      : [];
  } else {
    eintraege = [
      { href: "/", label: "Dashboard", exakt: true },
      { href: "/kunden", label: "Kunden" },
    ];
    if (profil.rolle === "berater" || profil.rolle === "admin") {
      eintraege.push({ href: "/zeiterfassung", label: "Zeiterfassung" });
    }
    if (profil.rolle === "admin") eintraege.push({ href: "/admin", label: "Verwaltung" });
  }

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b bg-card/95 backdrop-blur">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href="/" className="font-semibold tracking-tight">
            <span className="text-primary">Linxys</span> Kundenportal
          </Link>
          <Navigation eintraege={eintraege} className="order-3 w-full sm:order-none sm:w-auto sm:flex-1" />
          <div className="ml-auto flex items-center gap-1">
            <Link
              href="/benachrichtigungen"
              className="relative rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
              aria-label={`Benachrichtigungen (${ungelesen ?? 0} ungelesen)`}
            >
              <Bell className="size-5" />
              {(ungelesen ?? 0) > 0 && (
                <span className="absolute -top-0.5 -right-0.5 flex min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-[11px] font-semibold text-white">
                  {ungelesen! > 99 ? "99+" : ungelesen}
                </span>
              )}
            </Link>
            <Link
              href="/profil"
              className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent"
              title={ROLLE_LABEL[profil.rolle]}
            >
              <UserRound className="size-5 text-muted-foreground" />
              <span className="hidden max-w-40 truncate md:inline">{profil.name}</span>
            </Link>
            <form action="/auth/abmelden" method="post">
              <button
                type="submit"
                className="rounded-md p-2 text-muted-foreground hover:bg-accent hover:text-foreground"
                aria-label="Abmelden"
                title="Abmelden"
              >
                <LogOut className="size-5" />
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl px-4 py-6 sm:py-8">{children}</main>
    </div>
  );
}
