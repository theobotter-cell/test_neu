import Link from "next/link";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { rolleErforderlich } from "@/lib/auth";
import { ladeBerater } from "@/lib/daten";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Seitenkopf } from "@/components/seitenkopf";
import { Feld } from "@/components/feld";
import { AktionForm } from "@/components/aktion-form";
import { AbsendenButton } from "@/components/absenden-button";
import { AktionButton } from "@/components/aktion-button";
import { KundenFelder } from "@/components/kunden-felder";
import { ansprechpartnerWechseln, beraterEntfernen, beraterZuordnen, einladungErneutSenden, kundeAktualisieren } from "@/lib/aktionen/admin";
import type { Kunde, Profil } from "@/lib/types";

export const metadata: Metadata = { title: "Kunde verwalten" };

export default async function AdminKunde({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { supabase } = await rolleErforderlich("admin");
  const { data: kunde } = await supabase.from("customers").select("*").eq("id", id).maybeSingle<Kunde>();
  if (!kunde) notFound();

  const [berater, zuordnungen, login] = await Promise.all([
    ladeBerater(supabase),
    supabase.from("customer_consultants").select("berater_id, profiles(name)").eq("customer_id", id),
    kunde.kunde_user_id
      ? supabase.from("profiles").select("id, name, email, aktiv").eq("id", kunde.kunde_user_id).maybeSingle<Profil>()
      : Promise.resolve({ data: null }),
  ]);
  const zugeordnet = (zuordnungen.data ?? []).map((z) => ({
    id: z.berater_id as string,
    name: (z.profiles as unknown as { name: string } | null)?.name ?? "–",
  }));
  const verfuegbar = berater.filter((b) => b.id !== kunde.hauptberater_id && !zugeordnet.some((z) => z.id === b.id));

  return (
    <div className="max-w-4xl space-y-6">
      <Seitenkopf
        titel={kunde.firmenname}
        aktionen={
          <Link href={`/k/${id}`} className={buttonVariants({ variant: "outline" })}>
            Zum Kunden
          </Link>
        }
      />

      <Card>
        <CardHeader>
          <CardTitle>Stammdaten</CardTitle>
        </CardHeader>
        <CardContent>
          <AktionForm aktion={kundeAktualisieren.bind(null, id)} className="grid gap-4">
            <KundenFelder kunde={kunde} berater={berater} />
            <AbsendenButton className="justify-self-start">Speichern</AbsendenButton>
          </AktionForm>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Weitere zugeordnete Berater</CardTitle>
          <CardDescription>Zusätzlich zum Hauptberater mit vollem Bearbeitungszugriff</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {zugeordnet.length === 0 ? (
            <p className="text-sm text-muted-foreground">Keine weiteren Berater zugeordnet.</p>
          ) : (
            <ul className="space-y-2">
              {zugeordnet.map((z) => (
                <li key={z.id} className="flex items-center justify-between gap-2 text-sm">
                  {z.name}
                  <AktionButton aktion={beraterEntfernen.bind(null, id, z.id)} bestaetigung={`${z.name} entfernen?`}>
                    Entfernen
                  </AktionButton>
                </li>
              ))}
            </ul>
          )}
          {verfuegbar.length > 0 && (
            <AktionForm aktion={beraterZuordnen.bind(null, id)} className="flex flex-wrap items-end gap-2">
              <Feld label="Berater hinzufügen" htmlFor="berater_id">
                <Select id="berater_id" name="berater_id" className="w-64" required>
                  <option value="">– wählen –</option>
                  {verfuegbar.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              </Feld>
              <AbsendenButton variant="secondary">Zuordnen</AbsendenButton>
            </AktionForm>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kunden-Login</CardTitle>
          <CardDescription>Genau ein Login pro Kunde. Beim Wechsel wird der bisherige Login deaktiviert.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {login.data ? (
            <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
              <span>
                <span className="font-medium">{login.data.name}</span> · {login.data.email}{" "}
                {login.data.aktiv ? <Badge variant="success">aktiv</Badge> : <Badge variant="danger">deaktiviert</Badge>}
              </span>
              <AktionButton aktion={einladungErneutSenden.bind(null, login.data.id)}>Link zum Passwort senden</AktionButton>
            </div>
          ) : (
            <p className="text-sm text-destructive">Noch kein Kunden-Login hinterlegt.</p>
          )}
          <AktionForm aktion={ansprechpartnerWechseln.bind(null, id)} zuruecksetzen className="grid gap-4 rounded-lg border p-4 sm:grid-cols-3 sm:items-end">
            <Feld label="Name neuer Ansprechpartner" htmlFor="ap_name">
              <Input id="ap_name" name="name" required />
            </Feld>
            <Feld label="E-Mail" htmlFor="ap_email">
              <Input id="ap_email" name="email" type="email" required />
            </Feld>
            <AbsendenButton
              variant="outline"
              bestaetigung={login.data ? `Ansprechpartner wechseln? ${login.data.name} verliert den Zugang.` : undefined}
            >
              {login.data ? "Ansprechpartner wechseln" : "Login einladen"}
            </AbsendenButton>
          </AktionForm>
        </CardContent>
      </Card>
    </div>
  );
}
