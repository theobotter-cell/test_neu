/** Übersetzt Datenbank-/API-Fehler in verständliche deutsche Meldungen. */
type DbFehler = { code?: string; message?: string } | null | undefined;

const ENGLISCH = /row-level security|permission denied|violates|duplicate key|foreign key|null value/i;

export function fehlerText(fehler: DbFehler, standard = "Die Aktion konnte nicht ausgeführt werden."): string {
  if (!fehler) return standard;
  const { code, message = "" } = fehler;
  switch (code) {
    case "23505":
      return "Dieser Eintrag existiert bereits.";
    case "23503":
      return "Der Eintrag wird noch verwendet (z. B. im Verlauf) und kann nicht gelöscht werden.";
    case "23502":
      return "Bitte alle Pflichtfelder ausfüllen.";
    case "22P02":
      return "Ungültige Eingabe.";
    case "PGRST116":
      return "Der Eintrag wurde nicht gefunden oder Sie haben keinen Zugriff.";
  }
  // Eigene Meldungen aus den Datenbankfunktionen sind bereits deutsch
  if (message && !ENGLISCH.test(message)) return message;
  if (code === "42501") return "Für diese Aktion fehlt Ihnen die Berechtigung.";
  if (code === "23514") return "Die Eingabe ist ungültig.";
  return standard;
}
