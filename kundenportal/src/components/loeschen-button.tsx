"use client";

import * as React from "react";
import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AktionErgebnis } from "@/lib/types";

/** Löschen mit Rückfrage; zeigt Fehler der Server Action an */
export function LoeschenButton({
  aktion,
  bestaetigung,
  label = "Löschen",
}: {
  aktion: () => Promise<AktionErgebnis>;
  bestaetigung: string;
  label?: string;
}) {
  const [fehler, setFehler] = React.useState<string | null>(null);
  const [laeuft, startTransition] = React.useTransition();
  return (
    <div className="inline-flex flex-col gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="text-destructive"
        disabled={laeuft}
        onClick={() => {
          if (!window.confirm(bestaetigung)) return;
          startTransition(async () => {
            const r = await aktion();
            if (r && !r.ok) setFehler(r.fehler);
          });
        }}
      >
        <Trash2 /> {laeuft ? "Bitte warten …" : label}
      </Button>
      {fehler && <span className="text-xs text-destructive">{fehler}</span>}
    </div>
  );
}
