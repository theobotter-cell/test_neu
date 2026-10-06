"use client";

import { AktionForm } from "@/components/aktion-form";
import { AbsendenButton } from "@/components/absenden-button";
import type { AktionErgebnis } from "@/lib/types";

/** Einzelner Button für einen Statuswechsel ohne Pflichtangaben */
export function UebergangButton({
  aktion,
  label,
  variant = "default",
}: {
  aktion: (vorher: AktionErgebnis, daten: FormData) => Promise<AktionErgebnis>;
  label: string;
  variant?: "default" | "outline" | "destructive" | "secondary";
}) {
  return (
    <AktionForm aktion={aktion} className="inline-block">
      <AbsendenButton size="sm" variant={variant}>
        {label}
      </AbsendenButton>
    </AktionForm>
  );
}
