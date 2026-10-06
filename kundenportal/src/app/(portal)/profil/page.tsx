import type { Metadata } from "next";
import { sitzungErforderlich } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Seitenkopf } from "@/components/seitenkopf";
import { Feld } from "@/components/feld";
import { AktionForm } from "@/components/aktion-form";
import { AbsendenButton } from "@/components/absenden-button";
import { passwortAendern, profilSpeichern } from "@/lib/aktionen/profil";
import { ROLLE_LABEL } from "@/lib/workflow";

export const metadata: Metadata = { title: "Profil" };

export default async function Profil() {
  const { profil } = await sitzungErforderlich();
  const intern = profil.rolle === "berater" || profil.rolle === "admin";
  return (
    <div className="max-w-2xl space-y-6">
      <Seitenkopf titel="Profil" beschreibung={`${profil.email} · ${ROLLE_LABEL[profil.rolle]}`} />
      <Card>
        <CardHeader>
          <CardTitle>Angaben</CardTitle>
        </CardHeader>
        <CardContent>
          <AktionForm aktion={profilSpeichern} className="grid gap-4">
            <Feld label="Name" htmlFor="name">
              <Input id="name" name="name" defaultValue={profil.name} required />
            </Feld>
            {intern && (
              <Feld
                label="Buchungslink (z. B. Calendly)"
                htmlFor="buchungslink"
                hinweis="Wird Ihren Kunden als „Termin buchen“ angezeigt, wenn Sie Hauptberater sind."
              >
                <Input id="buchungslink" name="buchungslink" type="url" defaultValue={profil.buchungslink ?? ""} placeholder="https://" />
              </Feld>
            )}
            <AbsendenButton className="justify-self-start">Speichern</AbsendenButton>
          </AktionForm>
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Passwort ändern</CardTitle>
        </CardHeader>
        <CardContent>
          <AktionForm aktion={passwortAendern} zuruecksetzen className="grid gap-4">
            <Feld label="Neues Passwort" htmlFor="passwort" hinweis="Mindestens 10 Zeichen, Buchstaben und Ziffern.">
              <Input id="passwort" name="passwort" type="password" autoComplete="new-password" minLength={10} required />
            </Feld>
            <Feld label="Wiederholen" htmlFor="wiederholung">
              <Input id="wiederholung" name="wiederholung" type="password" autoComplete="new-password" minLength={10} required />
            </Feld>
            <AbsendenButton className="justify-self-start">Passwort ändern</AbsendenButton>
          </AktionForm>
        </CardContent>
      </Card>
    </div>
  );
}
