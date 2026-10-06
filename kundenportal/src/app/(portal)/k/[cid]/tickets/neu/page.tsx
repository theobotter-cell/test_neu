import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ladeKundenKontext } from "@/lib/auth";
import { Card, CardContent } from "@/components/ui/card";
import { Seitenkopf } from "@/components/seitenkopf";
import { AktionForm } from "@/components/aktion-form";
import { AbsendenButton } from "@/components/absenden-button";
import { TicketFelder } from "@/components/ticket-felder";
import { ticketAnlegen } from "@/lib/aktionen/tickets";

export const metadata: Metadata = { title: "Neues Ticket" };

export default async function NeuesTicket({ params }: { params: Promise<{ cid: string }> }) {
  const { cid } = await params;
  const ctx = await ladeKundenKontext(cid);
  if (!ctx.darfMitwirken) notFound();
  return (
    <div className="max-w-3xl">
      <Seitenkopf titel="Neues Ticket" beschreibung="Fehler, Fragen, Änderungswünsche oder Aufgaben" />
      <Card>
        <CardContent>
          <AktionForm aktion={ticketAnlegen.bind(null, cid)} className="grid gap-4">
            <TicketFelder />
            <AbsendenButton className="justify-self-start">Ticket anlegen</AbsendenButton>
          </AktionForm>
        </CardContent>
      </Card>
    </div>
  );
}
