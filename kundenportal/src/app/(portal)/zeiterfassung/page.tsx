import type { Metadata } from "next";
import { rolleErforderlich } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Seitenkopf, Leer } from "@/components/seitenkopf";
import { ZeitFormular } from "@/components/zeit-formular";
import { ZeitenTabelle, type ZeitZeile } from "@/components/zeiten-tabelle";
import { zeitAnlegen } from "@/lib/aktionen/zeiten";
import { heuteIso, plusTage } from "@/lib/format";

export const metadata: Metadata = { title: "Zeiterfassung" };

/** Schnellerfassung für Berater: alle eigenen Kunden in einem Formular */
export default async function Schnellerfassung() {
  const { supabase, profil } = await rolleErforderlich("berater", "admin");

  // Kunden, für die der Nutzer Zeiten erfassen darf
  let kundenAbfrage = supabase.from("customers").select("id, firmenname, hauptberater_id").order("firmenname");
  if (profil.rolle === "berater") {
    const { data: zuordnungen } = await supabase.from("customer_consultants").select("customer_id").eq("berater_id", profil.id);
    const ids = (zuordnungen ?? []).map((z) => z.customer_id);
    kundenAbfrage = kundenAbfrage.or(`hauptberater_id.eq.${profil.id}${ids.length ? `,id.in.(${ids.join(",")})` : ""}`);
  }
  const { data: kunden } = await kundenAbfrage;
  const kundenIds = (kunden ?? []).map((k) => k.id);

  const [stories, tickets, letzte] = await Promise.all([
    supabase.from("stories").select("id, customer_id, titel").in("customer_id", kundenIds).neq("status", "abgenommen").order("titel"),
    supabase.from("tickets").select("id, customer_id, titel").in("customer_id", kundenIds).neq("status", "erledigt").order("titel"),
    supabase
      .from("time_entries")
      .select("*")
      .eq("erfasst_von", profil.id)
      .gte("datum", plusTage(heuteIso(), -14))
      .order("datum", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(50),
  ]);
  const firmen = new Map((kunden ?? []).map((k) => [k.id, k.firmenname]));

  return (
    <>
      <Seitenkopf titel="Zeiterfassung" beschreibung="Schnellerfassung für alle Ihre Kunden" />
      <Card className="mb-6">
        <CardContent>
          {kundenIds.length === 0 ? (
            <Leer>Ihnen sind keine Kunden zugeordnet.</Leer>
          ) : (
            <ZeitFormular
              aktion={zeitAnlegen}
              kunden={(kunden ?? []).map((k) => ({ id: k.id, firmenname: k.firmenname }))}
              stories={stories.data ?? []}
              tickets={tickets.data ?? []}
              heute={heuteIso()}
            />
          )}
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Ihre Einträge der letzten 14 Tage</CardTitle>
        </CardHeader>
        <CardContent>
          {(letzte.data ?? []).length === 0 ? (
            <Leer>Noch keine Einträge.</Leer>
          ) : (
            <div className="space-y-6">
              {[...new Set((letzte.data ?? []).map((z) => z.customer_id as string))].map((cid) => (
                <div key={cid}>
                  <h3 className="mb-2 font-medium">{firmen.get(cid) ?? "Kunde"}</h3>
                  <ZeitenTabelle
                    zeiten={(letzte.data ?? []).filter((z) => z.customer_id === cid) as ZeitZeile[]}
                    namen={new Map([[profil.id, profil.name]])}
                    istKunde={false}
                    basis={`/k/${cid}`}
                    bearbeitenLink={(z) => `/k/${cid}/zeiten/${z.id}`}
                  />
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
