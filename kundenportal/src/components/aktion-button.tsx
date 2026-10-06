"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import type { AktionErgebnis } from "@/lib/types";

/** Button, der eine parameterlose Server Action ausführt und Fehler anzeigt */
export function AktionButton({
  aktion,
  children,
  bestaetigung,
  variant = "outline",
  size = "sm",
}: {
  aktion: () => Promise<AktionErgebnis>;
  children: React.ReactNode;
  bestaetigung?: string;
  variant?: React.ComponentProps<typeof Button>["variant"];
  size?: React.ComponentProps<typeof Button>["size"];
}) {
  const [meldung, setMeldung] = React.useState<{ ok: boolean; text: string } | null>(null);
  const [laeuft, startTransition] = React.useTransition();
  return (
    <span className="inline-flex flex-col gap-1">
      <Button
        type="button"
        variant={variant}
        size={size}
        disabled={laeuft}
        onClick={() => {
          if (bestaetigung && !window.confirm(bestaetigung)) return;
          startTransition(async () => {
            const r = await aktion();
            if (r) setMeldung(r.ok ? (r.meldung ? { ok: true, text: r.meldung } : null) : { ok: false, text: r.fehler });
          });
        }}
      >
        {laeuft ? "Bitte warten …" : children}
      </Button>
      {meldung && <span className={meldung.ok ? "text-xs text-success" : "text-xs text-destructive"}>{meldung.text}</span>}
    </span>
  );
}
