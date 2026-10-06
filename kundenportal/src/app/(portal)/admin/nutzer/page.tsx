import type { Metadata } from "next";
import { rolleErforderlich } from "@/lib/auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Seitenkopf } from "@/components/seitenkopf";
import { Feld } from "@/components/feld";
import { AktionForm } from "@/components/aktion-form";
import { AbsendenButton } from "@/components/absenden-button";
import { AktionButton } from "@/components/aktion-button";
import { nutzerAktivSetzen, nutzerAktualisieren, nutzerEinladen } from "@/lib/aktionen/admin";
import { ROLLE_LABEL } from "@/lib/workflow";
import type { Profil } from "@/lib/types";

export const metadata: Metadata = { title: "Nutzer verwalten" };

export default async function AdminNutzer({ searchParams }: { searchParams: Promise<{ bearbeiten?: string }> }) {
  const { supabase, profil: ich } = await rolleErforderlich("admin");
  const { bearbeiten } = await searchParams;
  const { data } = await supabase.from("profiles").select("*").order("rolle").order("name");
  const nutzer = (data ?? []) as Profil[];
  const inBearbeitung = nutzer.find((n) => n.id === bearbeiten);

  return (
    <>
      <Seitenkopf titel="Nutzer" beschreibung="Keine öffentliche Registrierung – Nutzer werden hier eingeladen." />
      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>E-Mail</TableHead>
                  <TableHead>Rolle</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {nutzer.map((n) => (
                  <TableRow key={n.id}>
                    <TableCell className="font-medium">{n.name}</TableCell>
                    <TableCell className="text-sm">{n.email}</TableCell>
                    <TableCell>{ROLLE_LABEL[n.rolle]}</TableCell>
                    <TableCell>{n.aktiv ? <Badge variant="success">aktiv</Badge> : <Badge variant="danger">deaktiviert</Badge>}</TableCell>
                    <TableCell className="text-right whitespace-nowrap">
                      {n.rolle !== "kunde" && (
                        <a href={`/admin/nutzer?bearbeiten=${n.id}`} className="mr-3 text-sm text-primary hover:underline">
                          Bearbeiten
                        </a>
                      )}
                      {n.id !== ich.id && (
                        <AktionButton
                          aktion={nutzerAktivSetzen.bind(null, n.id, !n.aktiv)}
                          bestaetigung={n.aktiv ? `${n.name} deaktivieren?` : `${n.name} wieder aktivieren?`}
                        >
                          {n.aktiv ? "Deaktivieren" : "Aktivieren"}
                        </AktionButton>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            <p className="mt-3 text-xs text-muted-foreground">Kunden-Logins werden unter Verwaltung › Kunden gewechselt.</p>
          </CardContent>
        </Card>

        <div className="space-y-6">
          {inBearbeitung && (
            <Card>
              <CardHeader>
                <CardTitle>{inBearbeitung.name} bearbeiten</CardTitle>
              </CardHeader>
              <CardContent>
                <AktionForm key={inBearbeitung.id} aktion={nutzerAktualisieren.bind(null, inBearbeitung.id)} className="grid gap-4">
                  <Feld label="Name" htmlFor="b_name">
                    <Input id="b_name" name="name" defaultValue={inBearbeitung.name} required />
                  </Feld>
                  <Feld label="Rolle" htmlFor="b_rolle">
                    <Select id="b_rolle" name="rolle" defaultValue={inBearbeitung.rolle}>
                      <option value="berater">{ROLLE_LABEL.berater}</option>
                      <option value="customer_success">{ROLLE_LABEL.customer_success}</option>
                      <option value="admin">{ROLLE_LABEL.admin}</option>
                    </Select>
                  </Feld>
                  <Feld label="Buchungslink" htmlFor="b_link">
                    <Input id="b_link" name="buchungslink" type="url" defaultValue={inBearbeitung.buchungslink ?? ""} />
                  </Feld>
                  <AbsendenButton className="justify-self-start">Speichern</AbsendenButton>
                </AktionForm>
              </CardContent>
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Nutzer einladen</CardTitle>
            </CardHeader>
            <CardContent>
              <AktionForm aktion={nutzerEinladen} zuruecksetzen className="grid gap-4">
                <Feld label="Name" htmlFor="name">
                  <Input id="name" name="name" required />
                </Feld>
                <Feld label="E-Mail" htmlFor="email">
                  <Input id="email" name="email" type="email" required />
                </Feld>
                <Feld label="Rolle" htmlFor="rolle">
                  <Select id="rolle" name="rolle" defaultValue="berater">
                    <option value="berater">{ROLLE_LABEL.berater}</option>
                    <option value="customer_success">{ROLLE_LABEL.customer_success}</option>
                    <option value="admin">{ROLLE_LABEL.admin}</option>
                  </Select>
                </Feld>
                <Feld label="Buchungslink (Berater, optional)" htmlFor="buchungslink">
                  <Input id="buchungslink" name="buchungslink" type="url" placeholder="https://" />
                </Feld>
                <AbsendenButton className="justify-self-start">Einladung senden</AbsendenButton>
              </AktionForm>
            </CardContent>
          </Card>
        </div>
      </div>
    </>
  );
}
