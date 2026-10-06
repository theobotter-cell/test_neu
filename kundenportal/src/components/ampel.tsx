import { cn } from "@/lib/utils";
import type { Ampel as AmpelTyp } from "@/lib/cs-ampel";

const FARBE: Record<AmpelTyp, string> = { gruen: "bg-success", gelb: "bg-warning", rot: "bg-destructive" };
const TEXT: Record<AmpelTyp, string> = { gruen: "Grün", gelb: "Gelb", rot: "Rot" };

export function Ampel({ wert }: { wert: AmpelTyp }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm">
      <span className={cn("inline-block size-3 rounded-full", FARBE[wert])} aria-hidden />
      <span className="sr-only sm:not-sr-only">{TEXT[wert]}</span>
    </span>
  );
}
