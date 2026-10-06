/**
 * Anzeige-Texte und Spiegel der erlaubten Story-Übergänge für die Oberfläche.
 * MASSGEBLICH ist ausschließlich die Datenbankfunktion app.story_uebergang();
 * diese Tabelle dient nur dazu, unerlaubte Aktionen gar nicht erst anzubieten.
 */
import type { Rolle, StoryStatus, TicketPrioritaet, TicketStatus, TicketTyp, ZeitKategorie } from "./types";

export const STORY_STATUS: StoryStatus[] = [
  "entwurf",
  "zur_schaetzung_freigegeben",
  "geschaetzt",
  "zur_umsetzung_freigegeben",
  "in_umsetzung",
  "zur_abnahme",
  "abgenommen",
];

export const STORY_STATUS_LABEL: Record<StoryStatus, string> = {
  entwurf: "Entwurf",
  zur_schaetzung_freigegeben: "Zur Schätzung freigegeben",
  geschaetzt: "Geschätzt",
  zur_umsetzung_freigegeben: "Zur Umsetzung freigegeben",
  in_umsetzung: "In Umsetzung",
  zur_abnahme: "Zur Abnahme",
  abgenommen: "Abgenommen",
};

export type Uebergang = {
  von: StoryStatus;
  nach: StoryStatus;
  rolle: "kunde" | "berater";
  aktion: string;
  label: string;
  kommentarPflicht: boolean;
  schaetzungPflicht: boolean;
  /** Ablehnung (rot darstellen) */
  negativ?: boolean;
};

export const UEBERGAENGE: Uebergang[] = [
  { von: "entwurf", nach: "zur_schaetzung_freigegeben", rolle: "kunde", aktion: "zur_schaetzung_freigegeben", label: "Zur Schätzung freigeben", kommentarPflicht: false, schaetzungPflicht: false },
  { von: "zur_schaetzung_freigegeben", nach: "geschaetzt", rolle: "berater", aktion: "geschaetzt", label: "Schätzung eintragen", kommentarPflicht: false, schaetzungPflicht: true },
  { von: "geschaetzt", nach: "zur_umsetzung_freigegeben", rolle: "kunde", aktion: "zur_umsetzung_freigegeben", label: "Zur Umsetzung freigeben", kommentarPflicht: false, schaetzungPflicht: false },
  { von: "geschaetzt", nach: "entwurf", rolle: "kunde", aktion: "schaetzung_abgelehnt", label: "Schätzung ablehnen", kommentarPflicht: true, schaetzungPflicht: false, negativ: true },
  { von: "zur_umsetzung_freigegeben", nach: "in_umsetzung", rolle: "berater", aktion: "umsetzung_begonnen", label: "Umsetzung beginnen", kommentarPflicht: false, schaetzungPflicht: false },
  { von: "in_umsetzung", nach: "zur_abnahme", rolle: "berater", aktion: "zur_abnahme_gestellt", label: "Zur Abnahme stellen", kommentarPflicht: false, schaetzungPflicht: false },
  { von: "zur_abnahme", nach: "abgenommen", rolle: "kunde", aktion: "abgenommen", label: "Abnehmen", kommentarPflicht: false, schaetzungPflicht: false },
  { von: "zur_abnahme", nach: "in_umsetzung", rolle: "kunde", aktion: "abnahme_abgelehnt", label: "Abnahme ablehnen", kommentarPflicht: true, schaetzungPflicht: false, negativ: true },
];

export const AKTION_LABEL: Record<string, string> = {
  zur_schaetzung_freigegeben: "zur Schätzung freigegeben",
  geschaetzt: "geschätzt",
  zur_umsetzung_freigegeben: "zur Umsetzung freigegeben",
  schaetzung_abgelehnt: "Schätzung abgelehnt",
  umsetzung_begonnen: "Umsetzung begonnen",
  zur_abnahme_gestellt: "zur Abnahme gestellt",
  abgenommen: "abgenommen",
  abnahme_abgelehnt: "Abnahme abgelehnt",
};

/**
 * Welche Übergänge darf diese Rolle aus dem Status ausführen?
 * admin darf alle; "darfBearbeiten" = zugeordneter Berater bzw. admin.
 */
export function erlaubteUebergaenge(von: StoryStatus, rolle: Rolle, darfBearbeiten: boolean): Uebergang[] {
  return UEBERGAENGE.filter((u) => {
    if (u.von !== von) return false;
    if (rolle === "admin") return true;
    if (u.rolle === "kunde") return rolle === "kunde";
    return rolle === "berater" && darfBearbeiten;
  });
}

export function findeUebergang(von: StoryStatus, nach: StoryStatus): Uebergang | undefined {
  return UEBERGAENGE.find((u) => u.von === von && u.nach === nach);
}

export const TICKET_STATUS: TicketStatus[] = ["neu", "in_arbeit", "wartet_auf_kunde", "erledigt"];
export const TICKET_STATUS_LABEL: Record<TicketStatus, string> = {
  neu: "Neu",
  in_arbeit: "In Arbeit",
  wartet_auf_kunde: "Wartet auf Kunde",
  erledigt: "Erledigt",
};
export const TICKET_TYP: TicketTyp[] = ["fehler", "frage", "aenderungswunsch", "aufgabe"];
export const TICKET_TYP_LABEL: Record<TicketTyp, string> = {
  fehler: "Fehler",
  frage: "Frage",
  aenderungswunsch: "Änderungswunsch",
  aufgabe: "Aufgabe",
};
export const TICKET_PRIORITAET: TicketPrioritaet[] = ["niedrig", "normal", "hoch", "kritisch"];
export const TICKET_PRIORITAET_LABEL: Record<TicketPrioritaet, string> = {
  niedrig: "Niedrig",
  normal: "Normal",
  hoch: "Hoch",
  kritisch: "Kritisch",
};

export const KATEGORIE_LABEL: Record<ZeitKategorie, string> = {
  beratung: "Beratung",
  entwicklung: "Entwicklung",
};

export const ROLLE_LABEL: Record<Rolle, string> = {
  admin: "Administration",
  berater: "Berater/in",
  customer_success: "Customer Success",
  kunde: "Kunde",
};

export const BERICHT_LABEL = {
  woechentlich: "Wöchentlich (montags)",
  monatlich: "Monatlich (am 1.)",
  aus: "Kein Bericht",
} as const;
