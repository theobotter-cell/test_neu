import { describe, expect, it } from "vitest";
import { monatPruefen } from "@/lib/monatspruefung";

const zeit = (id: string, datum: string, h: number, kategorie: "beratung" | "entwicklung", beschreibung = "x", story_id: string | null = null) => ({
  id, datum, dauer_stunden: String(h), kategorie, beschreibung, story_id, ticket_id: null,
});

describe("Monatsabschluss-Prüfhinweise", () => {
  it("erkennt fehlende Beschreibung, Tage über 10 h und Entwicklung ohne Bezug", () => {
    const hinweise = monatPruefen([
      zeit("1", "2026-09-01", 6, "beratung"),
      zeit("2", "2026-09-01", 5, "entwicklung", "Code", "s1"),
      zeit("3", "2026-09-02", 2, "beratung", "  "),
      zeit("4", "2026-09-03", 3, "entwicklung", "ohne Bezug"),
      zeit("5", "2026-09-04", 10, "beratung"),
    ]);
    expect(hinweise.map((h) => h.art)).toEqual(["ohne_beschreibung", "tag_ueber_limit", "entwicklung_ohne_bezug"]);
    expect(hinweise[0].zeitIds).toEqual(["3"]);
    expect(hinweise[1].zeitIds).toEqual(["1", "2"]);
    expect(hinweise[1].text).toContain("01.09.2026");
    expect(hinweise[2].zeitIds).toEqual(["4"]);
  });

  it("genau 10 h ist kein Hinweis", () => {
    expect(monatPruefen([zeit("1", "2026-09-04", 10, "beratung")])).toEqual([]);
  });
});
