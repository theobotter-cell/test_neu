/**
 * Zentral konfigurierbare Schwellenwerte und Konstanten.
 * (Die Kontingent-Warnschwellen 80/100 % liegen in der Datenbank:
 *  app.kontingent_schwellen(), da die Warnungen per Trigger erzeugt werden.)
 */
export const CS_SCHWELLEN = {
  /** Ampel rot, wenn das Restkontingent unter diesem Anteil (in %) liegt */
  restkontingentProzent: 20,
  /** Keine Aktivität (Zeiten, Kommentare, Tickets) seit so vielen Tagen */
  inaktivTage: 21,
  /** Freigaben/Tickets liegen seit mehr als so vielen Tagen beim Kunden */
  wartetBeimKundenTage: 7,
  /** Abgelehnte Schätzungen/Abnahmen innerhalb der letzten Tage */
  ablehnungenTage: 30,
} as const;

/** Monatsabschluss: Tage mit mehr Stunden für einen Kunden werden markiert */
export const MAX_STUNDEN_PRO_TAG = 10;

/** Zeitraum für "Stunden der letzten X Tage" im Kunden-Dashboard */
export const DASHBOARD_STUNDEN_TAGE = 30;

/** Maximale Größe von Transkript-Dateien (muss zum Storage-Bucket passen) */
export const MAX_TRANSKRIPT_BYTES = 20 * 1024 * 1024;

export const TRANSKRIPT_BUCKET = "transkripte";

export function appUrl(): string {
  return (process.env.APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}
