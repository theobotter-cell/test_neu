import { describe, expect, it } from "vitest";
import { berichtErzeugen, faelligeZeitraeume } from "@/lib/bericht";

describe("Periodischer Bericht", () => {
  it("Wochenbericht montags, Monatsbericht am 1.", () => {
    expect(faelligeZeitraeume("2026-10-05")).toEqual([{ intervall: "woechentlich", von: "2026-09-28", bis: "2026-10-04" }]);
    expect(faelligeZeitraeume("2026-10-01")).toEqual([{ intervall: "monatlich", von: "2026-09-01", bis: "2026-09-30" }]);
    expect(faelligeZeitraeume("2026-06-01")).toEqual([
      { intervall: "woechentlich", von: "2026-05-25", bis: "2026-05-31" },
      { intervall: "monatlich", von: "2026-05-01", bis: "2026-05-31" },
    ]);
    expect(faelligeZeitraeume("2026-01-01")[0]).toEqual({ intervall: "monatlich", von: "2025-12-01", bis: "2025-12-31" });
    expect(faelligeZeitraeume("2026-10-06")).toEqual([]);
  });

  it("enthält alle Abschnitte und maskiert HTML", () => {
    const { betreff, html, text } = berichtErzeugen({
      firmenname: "Muster <GmbH>",
      empfaengerName: "Max",
      von: "2026-09-01",
      bis: "2026-09-30",
      stunden: { beratung: 3.5, entwicklung: 2 },
      kontingent: { gesamt: 30, verbraucht: 32, rest: -2 },
      erledigteTickets: [{ titel: "Logo" }],
      abgenommeneStories: [{ titel: "Dubletten" }],
      offeneFreigaben: [{ titel: "Dashboard", art: "story", status: "Geschätzt" }],
      termine: [{ datum: "2026-09-10", titel: "Review" }],
      portalLink: "https://portal.example/k/1",
    });
    expect(betreff).toBe("Ihr Bericht 01.09.2026 – 30.09.2026 – Muster <GmbH>");
    expect(html).toContain("Muster &lt;GmbH&gt;");
    expect(html).not.toContain("<GmbH>");
    for (const teil of ["3,5 h", "5,5 h", "-2 h", "Logo", "Dubletten", "Dashboard", "10.09.2026 – Review"]) {
      expect(html).toContain(teil);
    }
    expect(text).toContain("Rest -2 h");
  });
});
