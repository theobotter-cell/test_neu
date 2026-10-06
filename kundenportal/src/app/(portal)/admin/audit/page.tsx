import type { Metadata } from "next";
import { rolleErforderlich } from "@/lib/auth";
import { ladeNamen } from "@/lib/daten";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Seitenkopf } from "@/components/seitenkopf";
import { formatDatumZeit } from "@/lib/format";

export const metadata: Metadata = { title: "Audit-Log" };

export default async function AuditLog() {
  const { supabase } = await rolleErforderlich("admin");
  const { data } = await supabase.from("audit_log").select("*").order("created_at", { ascending: false }).limit(200);
  const eintraege = data ?? [];
  const namen = await ladeNamen(supabase, eintraege.map((e) => e.user_id));
  return (
    <>
      <Seitenkopf titel="Audit-Log" beschreibung="Unveränderliches Protokoll administrativer Vorgänge (letzte 200)" />
      <Card>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Zeitpunkt</TableHead>
                <TableHead>Person</TableHead>
                <TableHead>Aktion</TableHead>
                <TableHead>Objekt</TableHead>
                <TableHead>Details</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {eintraege.map((e) => (
                <TableRow key={e.id}>
                  <TableCell className="whitespace-nowrap tabular-nums">{formatDatumZeit(e.created_at)}</TableCell>
                  <TableCell>{e.user_id ? (namen.get(e.user_id) ?? "–") : "System"}</TableCell>
                  <TableCell className="font-medium">{e.aktion}</TableCell>
                  <TableCell className="text-xs">{e.objekt_typ}</TableCell>
                  <TableCell>
                    <pre className="max-w-md overflow-x-auto text-xs whitespace-pre-wrap text-muted-foreground">
                      {JSON.stringify(e.details, null, 1)}
                    </pre>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </>
  );
}
