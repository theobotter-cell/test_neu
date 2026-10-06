/**
 * CSV für deutsches Excel: Semikolon als Trenner, Dezimalkomma, UTF-8 mit BOM,
 * CRLF-Zeilenenden. Schutz vor CSV-/Formel-Injection: Zellen, die mit = + - @
 * (oder Tab/CR) beginnen, werden mit einem Apostroph entschärft.
 */
export type CsvWert = string | number | boolean | null | undefined;

const GEFAEHRLICH = /^[=+\-@\t\r]/;

export function csvZelle(wert: CsvWert): string {
  if (wert === null || wert === undefined) return "";
  let s: string;
  if (typeof wert === "number") {
    s = Number.isFinite(wert) ? String(wert).replace(".", ",") : "";
  } else if (typeof wert === "boolean") {
    s = wert ? "ja" : "nein";
  } else {
    s = wert;
    if (GEFAEHRLICH.test(s)) s = `'${s}`;
  }
  if (/[";\r\n]/.test(s)) s = `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function csvErzeugen(kopf: string[], zeilen: CsvWert[][]): string {
  const linien = [kopf, ...zeilen].map((z) => z.map(csvZelle).join(";"));
  return "﻿" + linien.join("\r\n") + "\r\n";
}

export function csvAntwort(inhalt: string, dateiname: string): Response {
  return new Response(inhalt, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${dateiname.replace(/[^\w.\-]/g, "_")}"`,
      "Cache-Control": "no-store",
    },
  });
}
