import { describe, expect, it } from "vitest";
import { formatDatum, formatMonat, formatStunden, monatsGrenzen, parseDezimal, plusTage, vormonat } from "@/lib/format";

describe("Formatierung", () => {
  it("Datum als TT.MM.JJJJ", () => {
    expect(formatDatum("2026-03-05")).toBe("05.03.2026");
    expect(formatDatum("2026-03-05T23:30:00Z")).toBe("06.03.2026"); // Europe/Berlin
    expect(formatDatum(null)).toBe("–");
  });

  it("Stunden als Dezimalzahl mit Komma", () => {
    expect(formatStunden(1.5)).toBe("1,5 h");
    expect(formatStunden("2.25")).toBe("2,25 h");
    expect(formatStunden(-3)).toBe("-3 h");
    expect(formatStunden(1000)).toBe("1.000 h");
  });

  it("parst deutsche und englische Dezimaleingaben", () => {
    expect(parseDezimal("1,5")).toBe(1.5);
    expect(parseDezimal(" 2.75 ")).toBe(2.75);
    expect(parseDezimal("")).toBeNull();
    expect(parseDezimal("abc")).toBeNull();
  });

  it("Monatsgrenzen, Vormonat, Tagesrechnung", () => {
    expect(monatsGrenzen("2024-02")).toEqual({ von: "2024-02-01", bis: "2024-02-29" });
    expect(vormonat("2026-01-15")).toBe("2025-12");
    expect(plusTage("2026-03-01", -1)).toBe("2026-02-28");
    expect(formatMonat("2026-09")).toBe("September 2026");
  });
});
