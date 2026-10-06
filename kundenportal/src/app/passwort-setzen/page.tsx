import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthRahmen } from "@/components/auth-rahmen";
import { AktionForm } from "@/components/aktion-form";
import { AbsendenButton } from "@/components/absenden-button";
import { Feld } from "@/components/feld";
import { Input } from "@/components/ui/input";
import { ladeSitzung } from "@/lib/auth";
import { passwortSetzen } from "./actions";

export const metadata: Metadata = { title: "Passwort festlegen" };

export default async function PasswortSetzenSeite() {
  const s = await ladeSitzung();
  if (!s) redirect("/login?hinweis=link");
  return (
    <AuthRahmen titel="Passwort festlegen" beschreibung={`Für ${s.user.email}`}>
      <AktionForm aktion={passwortSetzen} className="grid gap-4">
        <Feld label="Neues Passwort" htmlFor="passwort" hinweis="Mindestens 10 Zeichen, Buchstaben und Ziffern.">
          <Input id="passwort" name="passwort" type="password" autoComplete="new-password" minLength={10} required />
        </Feld>
        <Feld label="Passwort wiederholen" htmlFor="wiederholung">
          <Input id="wiederholung" name="wiederholung" type="password" autoComplete="new-password" minLength={10} required />
        </Feld>
        <AbsendenButton className="w-full">Passwort speichern</AbsendenButton>
      </AktionForm>
    </AuthRahmen>
  );
}
