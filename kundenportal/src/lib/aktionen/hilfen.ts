import { z } from "zod";

export const ID = z.string().regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, "Ungültige ID");
export const DATUM = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Ungültiges Datum");
export const MONAT = z.string().regex(/^\d{4}-(0[1-9]|1[0-2])$/, "Ungültiger Monat");

/** Getrimmter Text aus FormData ("" wenn nicht vorhanden) */
export function text(daten: FormData, feld: string): string {
  const v = daten.get(feld);
  return typeof v === "string" ? v.trim() : "";
}

/** Optionaler Text: leere Eingabe => null */
export function optText(daten: FormData, feld: string): string | null {
  const v = text(daten, feld);
  return v === "" ? null : v;
}

export function ersterFehler(e: z.ZodError): string {
  return e.issues[0]?.message ?? "Ungültige Eingabe.";
}
