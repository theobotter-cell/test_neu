import "server-only";
import { timingSafeEqual } from "node:crypto";

/** Prüft "Authorization: Bearer <CRON_SECRET>" (so ruft Vercel Cron auf) */
export function cronErlaubt(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const erwartet = Buffer.from(`Bearer ${secret}`);
  const erhalten = Buffer.from(request.headers.get("authorization") ?? "");
  return erhalten.length === erwartet.length && timingSafeEqual(erhalten, erwartet);
}
