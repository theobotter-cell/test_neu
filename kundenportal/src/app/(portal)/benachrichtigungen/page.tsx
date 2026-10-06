import Link from "next/link";
import type { Metadata } from "next";
import { sitzungErforderlich } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Seitenkopf, Leer } from "@/components/seitenkopf";
import { AktionButton } from "@/components/aktion-button";
import { alleGelesen } from "@/lib/aktionen/benachrichtigungen";
import { formatDatumZeit } from "@/lib/format";
import type { Benachrichtigung } from "@/lib/types";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Benachrichtigungen" };

export default async function Benachrichtigungen() {
  const { supabase } = await sitzungErforderlich();
  const { data } = await supabase.from("notifications").select("*").order("created_at", { ascending: false }).limit(100);
  const liste = (data ?? []) as Benachrichtigung[];
  const ungelesen = liste.filter((n) => !n.gelesen).length;

  return (
    <div className="max-w-3xl">
      <Seitenkopf
        titel="Benachrichtigungen"
        beschreibung={ungelesen ? `${ungelesen} ungelesen` : "Alles gelesen"}
        aktionen={ungelesen > 0 && <AktionButton aktion={alleGelesen}>Alle als gelesen markieren</AktionButton>}
      />
      <Card>
        <CardContent className="p-0">
          {liste.length === 0 ? (
            <div className="p-5">
              <Leer>Keine Benachrichtigungen.</Leer>
            </div>
          ) : (
            <ul className="divide-y">
              {liste.map((n) => (
                <li key={n.id}>
                  <Link
                    href={`/benachrichtigungen/${n.id}`}
                    className={cn("flex gap-3 px-5 py-3 transition-colors hover:bg-accent", !n.gelesen && "bg-primary/5")}
                  >
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", n.gelesen ? "bg-transparent" : "bg-primary")} aria-hidden />
                    <span className="flex-1">
                      <span className={cn("block text-sm", !n.gelesen && "font-medium")}>{n.text}</span>
                      <span className="text-xs text-muted-foreground">{formatDatumZeit(n.created_at)}</span>
                    </span>
                    {!n.gelesen && <span className="sr-only">ungelesen</span>}
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
