import { describe, expect, it } from "vitest";
import { erlaubteUebergaenge, UEBERGAENGE } from "@/lib/workflow";

describe("Story-Workflow (Spiegel der DB-Regeln)", () => {
  it("Kunde darf nur Kunden-Übergänge", () => {
    expect(erlaubteUebergaenge("entwurf", "kunde", false).map((u) => u.nach)).toEqual(["zur_schaetzung_freigegeben"]);
    expect(erlaubteUebergaenge("zur_schaetzung_freigegeben", "kunde", false)).toEqual([]);
    expect(erlaubteUebergaenge("geschaetzt", "kunde", false).map((u) => u.nach)).toEqual(["zur_umsetzung_freigegeben", "entwurf"]);
    expect(erlaubteUebergaenge("zur_abnahme", "kunde", false).map((u) => u.nach)).toEqual(["abgenommen", "in_umsetzung"]);
  });

  it("Berater nur mit Zuordnung und nur Berater-Übergänge", () => {
    expect(erlaubteUebergaenge("zur_schaetzung_freigegeben", "berater", true).map((u) => u.nach)).toEqual(["geschaetzt"]);
    expect(erlaubteUebergaenge("zur_schaetzung_freigegeben", "berater", false)).toEqual([]);
    expect(erlaubteUebergaenge("geschaetzt", "berater", true)).toEqual([]);
  });

  it("customer_success darf nichts, admin alles", () => {
    for (const u of UEBERGAENGE) {
      expect(erlaubteUebergaenge(u.von, "customer_success", true)).toEqual([]);
      expect(erlaubteUebergaenge(u.von, "admin", true)).toContain(u);
    }
  });

  it("Ablehnungen verlangen Kommentar, Schätzen verlangt Stunden", () => {
    expect(UEBERGAENGE.filter((u) => u.kommentarPflicht).map((u) => u.aktion)).toEqual(["schaetzung_abgelehnt", "abnahme_abgelehnt"]);
    expect(UEBERGAENGE.filter((u) => u.schaetzungPflicht).map((u) => u.aktion)).toEqual(["geschaetzt"]);
  });
});
