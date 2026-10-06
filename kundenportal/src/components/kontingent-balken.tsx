import { formatStunden } from "@/lib/format";
import { cn } from "@/lib/utils";
import type { KontingentStand } from "@/lib/types";

/** Kontingentbalken: gesamt, verbraucht (Beratung / Entwicklung), Rest */
export function KontingentBalken({ stand }: { stand: KontingentStand }) {
  const gesamt = Number(stand.gesamt);
  const beratung = Number(stand.verbraucht_beratung);
  const entwicklung = Number(stand.verbraucht_entwicklung);
  const rest = Number(stand.rest);
  const basis = Math.max(gesamt, beratung + entwicklung, 1);
  const pB = (beratung / basis) * 100;
  const pE = (entwicklung / basis) * 100;
  const quote = gesamt > 0 ? ((beratung + entwicklung) / gesamt) * 100 : 0;

  return (
    <div className="space-y-3">
      <div
        className="flex h-4 w-full overflow-hidden rounded-full bg-muted"
        role="img"
        aria-label={`Verbraucht ${Math.round(quote)} % des Kontingents`}
      >
        <div className="h-full bg-primary" style={{ width: `${pB}%` }} />
        <div className="h-full bg-sky-400" style={{ width: `${pE}%` }} />
      </div>
      <dl className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
        <div>
          <dt className="text-muted-foreground">Gesamt</dt>
          <dd className="font-semibold">{formatStunden(gesamt)}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-muted-foreground">
            <span className="inline-block size-2.5 rounded-sm bg-primary" /> Beratung
          </dt>
          <dd className="font-semibold">{formatStunden(beratung)}</dd>
        </div>
        <div>
          <dt className="flex items-center gap-1.5 text-muted-foreground">
            <span className="inline-block size-2.5 rounded-sm bg-sky-400" /> Entwicklung
          </dt>
          <dd className="font-semibold">{formatStunden(entwicklung)}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Rest</dt>
          <dd className={cn("font-semibold", rest < 0 && "text-destructive")}>{formatStunden(rest)}</dd>
        </div>
      </dl>
      {gesamt > 0 && (
        <p className={cn("text-xs text-muted-foreground", quote >= 80 && "font-medium text-amber-700", quote >= 100 && "text-destructive")}>
          {Math.round(quote)} % verbraucht
        </p>
      )}
    </div>
  );
}
