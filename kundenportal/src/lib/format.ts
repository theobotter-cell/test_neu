/** Formatierung für die deutschsprachige Oberfläche */

const zeitzone = "Europe/Berlin";

/** Datum als TT.MM.JJJJ. Akzeptiert ISO-Datum (YYYY-MM-DD) oder Zeitstempel. */
export function formatDatum(wert: string | Date | null | undefined): string {
  if (!wert) return "–";
  if (typeof wert === "string" && /^\d{4}-\d{2}-\d{2}$/.test(wert)) {
    const [j, m, t] = wert.split("-");
    return `${t}.${m}.${j}`;
  }
  const d = typeof wert === "string" ? new Date(wert) : wert;
  if (Number.isNaN(d.getTime())) return "–";
  return new Intl.DateTimeFormat("de-DE", {
    day: "2-digit", month: "2-digit", year: "numeric", timeZone: zeitzone,
  }).format(d);
}

/** Datum und Uhrzeit: TT.MM.JJJJ HH:MM */
export function formatDatumZeit(wert: string | Date | null | undefined): string {
  if (!wert) return "–";
  const d = typeof wert === "string" ? new Date(wert) : wert;
  if (Number.isNaN(d.getTime())) return "–";
  const datum = formatDatum(d);
  const zeit = new Intl.DateTimeFormat("de-DE", {
    hour: "2-digit", minute: "2-digit", timeZone: zeitzone,
  }).format(d);
  return `${datum} ${zeit}`;
}

/** Dezimalzahl mit Komma, max. 2 Nachkommastellen: 1,5 */
export function formatZahl(wert: number | string | null | undefined, nachkomma = 2): string {
  const n = typeof wert === "string" ? Number(wert) : (wert ?? 0);
  return new Intl.NumberFormat("de-DE", {
    minimumFractionDigits: 0,
    maximumFractionDigits: nachkomma,
  }).format(Number.isFinite(n) ? n : 0);
}

/** Stunden als Dezimalzahl: "1,5 h" */
export function formatStunden(wert: number | string | null | undefined): string {
  return `${formatZahl(wert)} h`;
}

export function formatEuro(wert: number | string | null | undefined): string {
  if (wert === null || wert === undefined || wert === "") return "–";
  return new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(Number(wert));
}

/** "2026-09" -> "September 2026" */
export function formatMonat(monat: string): string {
  const [j, m] = monat.split("-").map(Number);
  return new Intl.DateTimeFormat("de-DE", { month: "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(Date.UTC(j, m - 1, 1)));
}

/** Eingaben wie "1,5" oder "1.5" in eine Zahl umwandeln */
export function parseDezimal(wert: FormDataEntryValue | string | null | undefined): number | null {
  if (wert === null || wert === undefined) return null;
  const s = String(wert).trim().replace(/\s/g, "").replace(",", ".");
  if (s === "") return null;
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/** Heutiges Datum (Europe/Berlin) als YYYY-MM-DD */
export function heuteIso(): string {
  return isoDatum(new Date());
}

export function isoDatum(d: Date): string {
  const teile = new Intl.DateTimeFormat("en-CA", {
    year: "numeric", month: "2-digit", day: "2-digit", timeZone: zeitzone,
  }).format(d);
  return teile; // en-CA liefert YYYY-MM-DD
}

/** Verschiebt ein ISO-Datum um n Tage */
export function plusTage(iso: string, tage: number): string {
  const [j, m, t] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(j, m - 1, t + tage));
  return d.toISOString().slice(0, 10);
}

/** Erster und letzter Tag eines Monats (YYYY-MM) als ISO-Datum */
export function monatsGrenzen(monat: string): { von: string; bis: string } {
  const [j, m] = monat.split("-").map(Number);
  const von = new Date(Date.UTC(j, m - 1, 1)).toISOString().slice(0, 10);
  const bis = new Date(Date.UTC(j, m, 0)).toISOString().slice(0, 10);
  return { von, bis };
}

/** Vormonat zu einem ISO-Datum: "2026-10-06" -> "2026-09" */
export function vormonat(iso: string = heuteIso()): string {
  const [j, m] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(j, m - 2, 1));
  return d.toISOString().slice(0, 7);
}

export function tageSeit(wert: string | Date, jetzt: Date = new Date()): number {
  const d = typeof wert === "string" ? new Date(wert) : wert;
  return Math.floor((jetzt.getTime() - d.getTime()) / 86_400_000);
}
