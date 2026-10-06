"use client";

import { AktionForm } from "@/components/aktion-form";
import { AbsendenButton } from "@/components/absenden-button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type { AktionErgebnis } from "@/lib/types";

/** Statuswechsel mit Pflichtangaben (Schätzung, Ablehnungsbegründung) oder optionalem Kommentar */
export function UebergangFormular({
  aktion,
  label,
  kommentarPflicht,
  schaetzungPflicht,
  negativ,
}: {
  aktion: (vorher: AktionErgebnis, daten: FormData) => Promise<AktionErgebnis>;
  label: string;
  kommentarPflicht: boolean;
  schaetzungPflicht: boolean;
  negativ?: boolean;
}) {
  return (
    <AktionForm aktion={aktion} className="grid gap-2 rounded-lg border p-3">
      <p className="text-sm font-medium">{label}</p>
      {schaetzungPflicht && (
        <Input name="schaetzung" inputMode="decimal" placeholder="Schätzung in Stunden, z. B. 4,5" required aria-label="Schätzung in Stunden" />
      )}
      <Textarea
        name="kommentar"
        rows={2}
        required={kommentarPflicht}
        placeholder={kommentarPflicht ? "Begründung (Pflicht)" : "Kommentar (optional)"}
        aria-label="Kommentar"
      />
      <AbsendenButton size="sm" variant={negativ ? "destructive" : "default"} className="justify-self-start">
        {label}
      </AbsendenButton>
    </AktionForm>
  );
}
