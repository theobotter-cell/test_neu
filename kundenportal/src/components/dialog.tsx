"use client";

import * as React from "react";
import { X } from "lucide-react";

/** Schlichter, barrierearmer Modal-Dialog (Escape schließt, Fokus im Dialog) */
export function Dialog({
  offen,
  titel,
  beschreibung,
  onSchliessen,
  children,
}: {
  offen: boolean;
  titel: string;
  beschreibung?: string;
  onSchliessen: () => void;
  children: React.ReactNode;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => {
    if (!offen) return;
    const taste = (e: KeyboardEvent) => e.key === "Escape" && onSchliessen();
    window.addEventListener("keydown", taste);
    ref.current?.querySelector<HTMLElement>("input, textarea, button")?.focus();
    return () => window.removeEventListener("keydown", taste);
  }, [offen, onSchliessen]);

  if (!offen) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onMouseDown={onSchliessen}>
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-titel"
        className="w-full max-w-md rounded-xl border bg-card p-5 shadow-lg"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-4">
          <div>
            <h2 id="dialog-titel" className="font-semibold">
              {titel}
            </h2>
            {beschreibung && <p className="mt-1 text-sm text-muted-foreground">{beschreibung}</p>}
          </div>
          <button type="button" onClick={onSchliessen} className="rounded p-1 text-muted-foreground hover:bg-accent" aria-label="Schließen">
            <X className="size-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
