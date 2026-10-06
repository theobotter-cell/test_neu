import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ladeKundenKontext } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Alert } from "@/components/ui/alert";
import { Seitenkopf } from "@/components/seitenkopf";
import { ZeitFormular } from "@/components/zeit-formular";
import { LoeschenButton } from "@/components/loeschen-button";
import { zeitAktualisieren, zeitLoeschen } from "@/lib/aktionen/zeiten";
import { heuteIso } from "@/lib/format";
import type { Zeit } from "@/lib/types";

export const metadata: Metadata = { title: "Zeit bearbeiten" };

export default async function ZeitBearbeiten({ params }: { params: Promise<{ cid: string; zid: string }> }) {
  const { cid, zid } = await params;
  const ctx = await ladeKundenKontext(cid);
  if (!ctx.darfBearbeiten) notFound();
  const { supabase } = ctx;
  const { data: zeit } = await supabase.from("time_entries").select("*").eq("id", zid).eq("customer_id", cid).maybeSingle<Zeit>();
  if (!zeit) notFound();
  const [stories, tickets, gesperrt] = await Promise.all([
    supabase.from("stories").select("id, customer_id, titel").eq("customer_id", cid).order("titel"),
    supabase.from("tickets").select("id, customer_id, titel").eq("customer_id", cid).order("titel"),
    supabase.from("monatsabschluesse").select("id").eq("customer_id", cid).eq("monat", zeit.datum.slice(0, 7)).eq("status", "abgeschlossen").maybeSingle(),
  ]);

  return (
    <div className="max-w-4xl">
      <Seitenkopf titel="Zeit bearbeiten" />
      {gesperrt.data && (
        <Alert variant="warning" className="mb-4">
          Dieser Monat ist abgeschlossen. Änderungen sind erst nach Wiedereröffnung durch einen Admin möglich.
        </Alert>
      )}
      <Card>
        <CardContent className="space-y-4">
          <ZeitFormular
            aktion={zeitAktualisieren.bind(null, zid)}
            kunden={[{ id: cid, firmenname: ctx.kunde.firmenname }]}
            stories={stories.data ?? []}
            tickets={tickets.data ?? []}
            zeit={zeit}
            heute={heuteIso()}
            absendenLabel="Speichern"
          />
          <div className="border-t pt-4">
            <LoeschenButton aktion={zeitLoeschen.bind(null, zid)} bestaetigung="Diesen Zeiteintrag löschen?" label="Eintrag löschen" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
