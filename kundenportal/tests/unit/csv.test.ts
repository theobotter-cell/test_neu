import { describe, expect, it } from "vitest";
import { csvErzeugen, csvZelle } from "@/lib/csv";

describe("CSV-Export", () => {
  it("nutzt Semikolon, Dezimalkomma, BOM und CRLF", () => {
    const csv = csvErzeugen(["Datum", "Dauer"], [["01.02.2026", 1.5]]);
    expect(csv).toBe("﻿Datum;Dauer\r\n01.02.2026;1,5\r\n");
  });

  it("maskiert Trennzeichen und Anführungszeichen", () => {
    expect(csvZelle('Text; mit "Zitat"')).toBe('"Text; mit ""Zitat"""');
    expect(csvZelle("Zeile1\nZeile2")).toBe('"Zeile1\nZeile2"');
  });

  it("entschärft Formel-Injection", () => {
    expect(csvZelle("=HYPERLINK(\"x\")")).toBe("\"'=HYPERLINK(\"\"x\"\")\"");
    expect(csvZelle("+49 123")).toBe("'+49 123");
    expect(csvZelle("@SUM(A1)")).toBe("'@SUM(A1)");
    expect(csvZelle(-2)).toBe("-2"); // Zahlen bleiben Zahlen
  });

  it("Booleans und leere Werte", () => {
    expect(csvZelle(true)).toBe("ja");
    expect(csvZelle(null)).toBe("");
  });
});
