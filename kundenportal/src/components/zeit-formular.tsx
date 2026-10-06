"use client";

import * as React from "react";
import { AktionForm } from "@/components/aktion-form";
import { AbsendenButton } from "@/components/absenden-button";
import { Feld } from "@/components/feld";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatZahl } from "@/lib/format";
import type { AktionErgebnis, Zeit } from "@/lib/types";

type Option = { id: string; customer_id: string; titel: string };

/**
 * Zeiterfassung: Kunde, Datum, Dauer, Kategorie, Beschreibung und optional
 * Story/Ticket in einem Schritt. Story/Ticket-Auswahl passt sich dem Kunden an.
 */
export function ZeitFormular({
  aktion,
  kunden,
  stories,
  tickets,
  zeit,
  heute,
  absendenLabel = "Zeit erfassen",
}: {
  aktion: (vorher: AktionErgebnis, daten: FormData) => Promise<AktionErgebnis>;
  kunden: { id: string; firmenname: string }[];
  stories: Option[];
  tickets: Option[];
  zeit?: Zeit;
  heute: string;
  absendenLabel?: string;
}) {
  const [kunde, setKunde] = React.useState(zeit?.customer_id ?? (kunden.length === 1 ? kunden[0].id : ""));
  const [kategorie, setKategorie] = React.useState(zeit?.kategorie ?? "beratung");
  const kundenStories = stories.filter((s) => s.customer_id === kunde);
  const kundenTickets = tickets.filter((t) => t.customer_id === kunde);

  return (
    <AktionForm aktion={aktion} zuruecksetzen={!zeit} className="grid gap-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {kunden.length > 1 || zeit ? (
          <Feld label="Kunde" htmlFor="customer_id" className="lg:col-span-2">
            <Select
              id="customer_id"
              name="customer_id"
              value={kunde}
              onChange={(e) => setKunde(e.target.value)}
              required
              disabled={Boolean(zeit)}
            >
              <option value="">– Kunde wählen –</option>
              {kunden.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.firmenname}
                </option>
              ))}
            </Select>
            {zeit && <input type="hidden" name="customer_id" value={kunde} />}
          </Feld>
        ) : (
          <input type="hidden" name="customer_id" value={kunde} />
        )}
        <Feld label="Datum" htmlFor="datum">
          <Input id="datum" name="datum" type="date" defaultValue={zeit?.datum ?? heute} required />
        </Feld>
        <Feld label="Dauer (Stunden)" htmlFor="dauer_stunden" hinweis="z. B. 1,5">
          <Input
            id="dauer_stunden"
            name="dauer_stunden"
            inputMode="decimal"
            defaultValue={zeit ? formatZahl(zeit.dauer_stunden) : ""}
            placeholder="1,5"
            required
          />
        </Feld>
        <Feld label="Kategorie" htmlFor="kategorie">
          <Select id="kategorie" name="kategorie" value={kategorie} onChange={(e) => setKategorie(e.target.value as typeof kategorie)}>
            <option value="beratung">Beratung</option>
            <option value="entwicklung">Entwicklung</option>
          </Select>
        </Feld>
        <Feld label="Story (optional)" htmlFor="story_id">
          <Select id="story_id" name="story_id" defaultValue={zeit?.story_id ?? ""} key={`s-${kunde}`}>
            <option value="">– keine –</option>
            {kundenStories.map((s) => (
              <option key={s.id} value={s.id}>
                {s.titel}
              </option>
            ))}
          </Select>
        </Feld>
        <Feld label="Ticket (optional)" htmlFor="ticket_id">
          <Select id="ticket_id" name="ticket_id" defaultValue={zeit?.ticket_id ?? ""} key={`t-${kunde}`}>
            <option value="">– keines –</option>
            {kundenTickets.map((t) => (
              <option key={t.id} value={t.id}>
                {t.titel}
              </option>
            ))}
          </Select>
        </Feld>
        {kategorie === "entwicklung" && (
          <Feld label="Bitrix-Aufgabe (optional)" htmlFor="bitrix_task_id" hinweis="ID der Entwickleraufgabe">
            <Input id="bitrix_task_id" name="bitrix_task_id" defaultValue={zeit?.bitrix_task_id ?? ""} />
          </Feld>
        )}
      </div>
      <Feld label="Beschreibung" htmlFor="beschreibung">
        <Textarea id="beschreibung" name="beschreibung" defaultValue={zeit?.beschreibung} rows={2} />
      </Feld>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="abrechenbar" defaultChecked={zeit ? zeit.abrechenbar : true} className="size-4" />
        Abrechenbar (zählt zum Kontingent)
      </label>
      <AbsendenButton className="justify-self-start">{absendenLabel}</AbsendenButton>
    </AktionForm>
  );
}
