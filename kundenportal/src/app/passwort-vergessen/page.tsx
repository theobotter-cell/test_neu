import Link from "next/link";
import type { Metadata } from "next";
import { AuthRahmen } from "@/components/auth-rahmen";
import { AktionForm } from "@/components/aktion-form";
import { AbsendenButton } from "@/components/absenden-button";
import { Feld } from "@/components/feld";
import { Input } from "@/components/ui/input";
import { passwortZuruecksetzen } from "./actions";

export const metadata: Metadata = { title: "Passwort vergessen" };

export default function PasswortVergessenSeite() {
  return (
    <AuthRahmen titel="Passwort vergessen" beschreibung="Wir senden Ihnen einen Link zum Zurücksetzen.">
      <AktionForm aktion={passwortZuruecksetzen} className="grid gap-4">
        <Feld label="E-Mail" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Feld>
        <AbsendenButton className="w-full">Link anfordern</AbsendenButton>
        <Link href="/login" className="text-center text-sm text-muted-foreground hover:underline">
          Zurück zur Anmeldung
        </Link>
      </AktionForm>
    </AuthRahmen>
  );
}
