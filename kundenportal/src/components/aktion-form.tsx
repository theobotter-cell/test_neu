"use client";

import * as React from "react";
import { useActionState } from "react";
import { Alert } from "@/components/ui/alert";
import type { AktionErgebnis } from "@/lib/types";

type Props = Omit<React.ComponentProps<"form">, "action"> & {
  aktion: (vorher: AktionErgebnis, daten: FormData) => Promise<AktionErgebnis>;
  /** Formular nach Erfolg leeren */
  zuruecksetzen?: boolean;
};

/** Formular für Server Actions mit Fehler-/Erfolgsanzeige */
export function AktionForm({ aktion, zuruecksetzen, children, ...props }: Props) {
  const formRef = React.useRef<HTMLFormElement>(null);
  const [ergebnis, formAction] = useActionState(async (vorher: AktionErgebnis, daten: FormData) => {
    const r = await aktion(vorher, daten);
    if (r?.ok && zuruecksetzen) formRef.current?.reset();
    return r;
  }, null);

  return (
    <form ref={formRef} action={formAction} {...props}>
      {children}
      {ergebnis && !ergebnis.ok && (
        <Alert variant="destructive" className="mt-3">
          {ergebnis.fehler}
        </Alert>
      )}
      {ergebnis?.ok && ergebnis.meldung && (
        <Alert variant="success" className="mt-3">
          {ergebnis.meldung}
        </Alert>
      )}
    </form>
  );
}
