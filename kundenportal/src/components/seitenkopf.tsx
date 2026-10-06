import * as React from "react";

export function Seitenkopf({
  titel,
  beschreibung,
  aktionen,
}: {
  titel: React.ReactNode;
  beschreibung?: React.ReactNode;
  aktionen?: React.ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{titel}</h1>
        {beschreibung && <p className="mt-1 text-sm text-muted-foreground">{beschreibung}</p>}
      </div>
      {aktionen && <div className="flex flex-wrap gap-2">{aktionen}</div>}
    </div>
  );
}

export function Leer({ children }: { children: React.ReactNode }) {
  return <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">{children}</p>;
}
