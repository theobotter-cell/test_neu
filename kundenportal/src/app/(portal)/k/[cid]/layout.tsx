import Link from "next/link";
import { ladeKundenKontext } from "@/lib/auth";
import { Navigation, type NavEintrag } from "@/components/navigation";

export default async function KundenLayout({ children, params }: { children: React.ReactNode; params: Promise<{ cid: string }> }) {
  const { cid } = await params;
  const ctx = await ladeKundenKontext(cid);

  // Kunden-Logins navigieren über die Hauptnavigation
  if (!ctx.intern) return <>{children}</>;

  const basis = `/k/${cid}`;
  const eintraege: NavEintrag[] = [
    { href: basis, label: "Übersicht", exakt: true },
    { href: `${basis}/board`, label: "Board" },
    { href: `${basis}/zeiten`, label: "Zeiten" },
    { href: `${basis}/kontingente`, label: "Leistungen" },
    { href: `${basis}/termine`, label: "Termine" },
  ];
  if (ctx.darfBearbeiten) eintraege.push({ href: `${basis}/monatsabschluss`, label: "Monatsabschluss" });

  return (
    <div>
      <div className="mb-6 flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <Link href="/kunden" className="text-sm text-muted-foreground hover:underline">
            Kunden
          </Link>
          <span className="text-muted-foreground">/</span>
          <span className="font-semibold">{ctx.kunde.firmenname}</span>
          {ctx.profil.rolle === "admin" && (
            <Link href={`/admin/kunden/${cid}`} className="text-xs text-muted-foreground hover:underline">
              Stammdaten
            </Link>
          )}
        </div>
        <Navigation eintraege={eintraege} />
      </div>
      {children}
    </div>
  );
}
