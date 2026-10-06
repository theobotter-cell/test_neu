import { CS_SCHWELLEN } from "./config";
import type { KundenKennzahlen } from "./types";

export type AmpelGrund = "restkontingent" | "inaktiv" | "wartet_beim_kunden" | "ablehnung";
export type Ampel = "gruen" | "gelb" | "rot";

export const AMPEL_GRUND_LABEL: Record<AmpelGrund, string> = {
  restkontingent: `Restkontingent unter ${CS_SCHWELLEN.restkontingentProzent} %`,
  inaktiv: `Keine Aktivität seit ${CS_SCHWELLEN.inaktivTage} Tagen`,
  wartet_beim_kunden: `Liegt seit über ${CS_SCHWELLEN.wartetBeimKundenTage} Tagen beim Kunden`,
  ablehnung: `Ablehnung in den letzten ${CS_SCHWELLEN.ablehnungenTage} Tagen`,
};

const TAG = 86_400_000;

/** Bewertet einen Kunden anhand der zentral konfigurierten Schwellenwerte. */
export function ampelBewerten(k: KundenKennzahlen, jetzt: Date = new Date()): { ampel: Ampel; gruende: AmpelGrund[] } {
  const gruende: AmpelGrund[] = [];
  const t = jetzt.getTime();

  if (Number(k.gesamt) > 0 && k.rest_prozent !== null && Number(k.rest_prozent) < CS_SCHWELLEN.restkontingentProzent) {
    gruende.push("restkontingent");
  }
  if (!k.letzte_aktivitaet || t - new Date(k.letzte_aktivitaet).getTime() > CS_SCHWELLEN.inaktivTage * TAG) {
    gruende.push("inaktiv");
  }
  if (k.wartet_beim_kunden_seit && t - new Date(k.wartet_beim_kunden_seit).getTime() > CS_SCHWELLEN.wartetBeimKundenTage * TAG) {
    gruende.push("wartet_beim_kunden");
  }
  if (k.letzte_ablehnung_am && t - new Date(k.letzte_ablehnung_am).getTime() <= CS_SCHWELLEN.ablehnungenTage * TAG) {
    gruende.push("ablehnung");
  }

  const ampel: Ampel = gruende.length === 0 ? "gruen" : gruende.length === 1 ? "gelb" : "rot";
  // Kontingent unter Schwelle ist immer kritisch
  return { ampel: gruende.includes("restkontingent") && ampel === "gelb" ? "rot" : ampel, gruende };
}
