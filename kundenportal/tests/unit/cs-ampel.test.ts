import { describe, expect, it } from "vitest";
import { ampelBewerten } from "@/lib/cs-ampel";
import type { KundenKennzahlen } from "@/lib/types";

const jetzt = new Date("2026-10-06T12:00:00Z");
const tageHer = (n: number) => new Date(jetzt.getTime() - n * 86_400_000).toISOString();
const basis: KundenKennzahlen = {
  customer_id: "c", firmenname: "F", hauptberater_id: null, gesamt: "100", verbraucht: "10", rest: "90", rest_prozent: "90",
  offene_stories: 0, offene_tickets: 0, wartet_auf_kunde: 0, wartet_auf_berater: 0,
  wartet_beim_kunden_seit: null, letzte_aktivitaet: tageHer(1), letzte_ablehnung_am: null,
};

describe("Customer-Success-Ampel", () => {
  it("grün ohne Auffälligkeiten", () => {
    expect(ampelBewerten(basis, jetzt)).toEqual({ ampel: "gruen", gruende: [] });
  });
  it("Restkontingent unter 20 % ist rot", () => {
    expect(ampelBewerten({ ...basis, rest_prozent: "19.9", rest: "19.9" }, jetzt)).toEqual({ ampel: "rot", gruende: ["restkontingent"] });
  });
  it("keine Aktivität seit 21 Tagen", () => {
    expect(ampelBewerten({ ...basis, letzte_aktivitaet: tageHer(22) }, jetzt).gruende).toEqual(["inaktiv"]);
    expect(ampelBewerten({ ...basis, letzte_aktivitaet: tageHer(20) }, jetzt).gruende).toEqual([]);
  });
  it("wartet seit über 7 Tagen beim Kunden und Ablehnung in 30 Tagen", () => {
    const r = ampelBewerten({ ...basis, wartet_beim_kunden_seit: tageHer(8), letzte_ablehnung_am: tageHer(29) }, jetzt);
    expect(r).toEqual({ ampel: "rot", gruende: ["wartet_beim_kunden", "ablehnung"] });
    expect(ampelBewerten({ ...basis, letzte_ablehnung_am: tageHer(31) }, jetzt).gruende).toEqual([]);
  });
});
