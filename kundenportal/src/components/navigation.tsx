"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

export type NavEintrag = { href: string; label: string; exakt?: boolean };

export function Navigation({ eintraege, className }: { eintraege: NavEintrag[]; className?: string }) {
  const pfad = usePathname();
  return (
    <nav className={cn("flex gap-1 overflow-x-auto", className)}>
      {eintraege.map((e) => {
        const aktiv = e.exakt ? pfad === e.href : pfad === e.href || pfad.startsWith(e.href + "/");
        return (
          <Link
            key={e.href}
            href={e.href}
            className={cn(
              "rounded-md px-3 py-1.5 text-sm whitespace-nowrap transition-colors hover:bg-accent",
              aktiv ? "bg-accent font-medium text-foreground" : "text-muted-foreground",
            )}
          >
            {e.label}
          </Link>
        );
      })}
    </nav>
  );
}
