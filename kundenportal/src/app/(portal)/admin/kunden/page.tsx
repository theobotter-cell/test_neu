import Link from "next/link";
import type { Metadata } from "next";
import { rolleErforderlich } from "@/lib/auth";
import { ladeNamen } from "@/lib/daten";
import { Card, CardContent } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Seitenkopf, Leer } from "@/components/seitenkopf";
import { BERICHT_LABEL } from "@/lib/workflow";
import type { Kunde } from "@/lib/types";

export const metadata: Metadata = { title: "Kunden verwalten" };

export default async function AdminKunden() {
  const { supabase } = await rolleErforderlich("admin");
  const { data } = await supabase.from("customers").select("*").order("firmenname");
  const kunden = (data ?? []) as Kunde[];
  const namen = await ladeNamen(supabase, kunden.flatMap((k) => [k.hauptberater_id, k.kunde_user_id]));
  return (
    <>
      <Seitenkopf
        titel="Kunden"
        aktionen={
          <Link href="/admin/kunden/neu" className={buttonVariants()}>
            Kunde anlegen
          </Link>
        }
      />
      <Card>
        <CardContent>
          {kunden.length === 0 ? (
            <Leer>Noch keine Kunden angelegt.</Leer>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Firma</TableHead>
                  <TableHead>Hauptberater</TableHead>
                  <TableHead>Kunden-Login</TableHead>
                  <TableHead>Bericht</TableHead>
                  <TableHead>Bitrix-Firma</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {kunden.map((k) => (
                  <TableRow key={k.id}>
                    <TableCell>
                      <Link href={`/admin/kunden/${k.id}`} className="font-medium hover:underline">
                        {k.firmenname}
                      </Link>
                    </TableCell>
                    <TableCell>{k.hauptberater_id ? namen.get(k.hauptberater_id) : "–"}</TableCell>
                    <TableCell>{k.kunde_user_id ? namen.get(k.kunde_user_id) : <span className="text-destructive">fehlt</span>}</TableCell>
                    <TableCell>{BERICHT_LABEL[k.bericht_intervall]}</TableCell>
                    <TableCell>{k.bitrix_company_id ?? "–"}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </>
  );
}
