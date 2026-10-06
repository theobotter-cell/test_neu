import type { Metadata } from "next";
import { rolleErforderlich } from "@/lib/auth";
import { ladeBerater } from "@/lib/daten";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Seitenkopf } from "@/components/seitenkopf";
import { Feld } from "@/components/feld";
import { AktionForm } from "@/components/aktion-form";
import { AbsendenButton } from "@/components/absenden-button";
import { KundenFelder } from "@/components/kunden-felder";
import { kundeAnlegen } from "@/lib/aktionen/admin";

export const metadata: Metadata = { title: "Kunde anlegen" };

export default async function KundeNeu() {
  const { supabase } = await rolleErforderlich("admin");
  const berater = await ladeBerater(supabase);
  return (
    <div className="max-w-3xl">
      <Seitenkopf titel="Kunde anlegen" beschreibung="Das Board des Kunden steht sofort nach dem Anlegen bereit." />
      <AktionForm aktion={kundeAnlegen} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Stammdaten</CardTitle>
          </CardHeader>
          <CardContent>
            <KundenFelder berater={berater} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Kunden-Login (Ansprechpartner)</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2">
            <Feld label="Name" htmlFor="login_name">
              <Input id="login_name" name="login_name" />
            </Feld>
            <Feld label="E-Mail" htmlFor="login_email" hinweis="Erhält eine Einladung per E-Mail.">
              <Input id="login_email" name="login_email" type="email" />
            </Feld>
          </CardContent>
        </Card>
        <AbsendenButton>Kunde anlegen</AbsendenButton>
      </AktionForm>
    </div>
  );
}
