import Link from "next/link";
import type { Metadata } from "next";
import { AuthRahmen } from "@/components/auth-rahmen";
import { AktionForm } from "@/components/aktion-form";
import { AbsendenButton } from "@/components/absenden-button";
import { Feld } from "@/components/feld";
import { Input } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { anmelden } from "./actions";

export const metadata: Metadata = { title: "Anmelden" };

const HINWEISE: Record<string, string> = {
  deaktiviert: "Ihr Zugang ist deaktiviert. Bitte wenden Sie sich an Linxys.",
  link: "Der Link ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen an.",
  abgemeldet: "Sie wurden abgemeldet.",
  passwort: "Ihr Passwort wurde geändert. Bitte melden Sie sich an.",
};

export default async function LoginSeite({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const { weiter, hinweis } = await searchParams;
  return (
    <AuthRahmen titel="Anmelden" beschreibung="Melden Sie sich mit Ihren Zugangsdaten an.">
      {hinweis && HINWEISE[hinweis] && (
        <Alert className="mb-4" variant={hinweis === "abgemeldet" || hinweis === "passwort" ? "default" : "warning"}>
          {HINWEISE[hinweis]}
        </Alert>
      )}
      <AktionForm aktion={anmelden} className="grid gap-4">
        <input type="hidden" name="weiter" value={weiter ?? ""} />
        <Feld label="E-Mail" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Feld>
        <Feld label="Passwort" htmlFor="passwort">
          <Input id="passwort" name="passwort" type="password" autoComplete="current-password" required />
        </Feld>
        <AbsendenButton className="w-full">Anmelden</AbsendenButton>
        <Link href="/passwort-vergessen" className="text-center text-sm text-muted-foreground hover:underline">
          Passwort vergessen?
        </Link>
      </AktionForm>
    </AuthRahmen>
  );
}
