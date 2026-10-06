import { MAX_STUNDEN_PRO_TAG } from "./config";
import type { Zeit } from "./types";

export type Pruefhinweis = {
  art: "ohne_beschreibung" | "tag_ueber_limit" | "entwicklung_ohne_bezug";
  text: string;
  zeitIds: string[];
  datum?: string;
};

/**
 * Prüfhinweise für den Monatsabschluss:
 *  - Einträge ohne Beschreibung
 *  - Tage mit über MAX_STUNDEN_PRO_TAG Stunden für einen Kunden
 *  - Entwicklungszeiten ohne Story oder Ticket
 */
export function monatPruefen(zeiten: Pick<Zeit, "id" | "datum" | "dauer_stunden" | "beschreibung" | "kategorie" | "story_id" | "ticket_id">[]): Pruefhinweis[] {
  const hinweise: Pruefhinweis[] = [];

  const ohneBeschreibung = zeiten.filter((z) => z.beschreibung.trim() === "");
  if (ohneBeschreibung.length) {
    hinweise.push({
      art: "ohne_beschreibung",
      text: `${ohneBeschreibung.length} Eintrag/Einträge ohne Beschreibung`,
      zeitIds: ohneBeschreibung.map((z) => z.id),
    });
  }

  const proTag = new Map<string, { summe: number; ids: string[] }>();
  for (const z of zeiten) {
    const t = proTag.get(z.datum) ?? { summe: 0, ids: [] };
    t.summe += Number(z.dauer_stunden);
    t.ids.push(z.id);
    proTag.set(z.datum, t);
  }
  for (const [datum, t] of [...proTag.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    if (t.summe > MAX_STUNDEN_PRO_TAG) {
      hinweise.push({
        art: "tag_ueber_limit",
        text: `${datum.split("-").reverse().join(".")}: ${String(Math.round(t.summe * 100) / 100).replace(".", ",")} h an einem Tag (mehr als ${MAX_STUNDEN_PRO_TAG} h)`,
        zeitIds: t.ids,
        datum,
      });
    }
  }

  const ohneBezug = zeiten.filter((z) => z.kategorie === "entwicklung" && !z.story_id && !z.ticket_id);
  if (ohneBezug.length) {
    hinweise.push({
      art: "entwicklung_ohne_bezug",
      text: `${ohneBezug.length} Entwicklungszeit(en) ohne Story oder Ticket`,
      zeitIds: ohneBezug.map((z) => z.id),
    });
  }
  return hinweise;
}
