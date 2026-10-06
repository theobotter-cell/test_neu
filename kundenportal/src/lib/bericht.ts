/**
 * Periodischer Bericht an den Kunden (wöchentlich montags / monatlich am 1.).
 * Kein KI-Text: Der Bericht wird ausschließlich aus den Daten erzeugt.
 */
import { esc, knopf, mailLayout } from "./email/vorlagen";
import { formatDatum, formatStunden, plusTage } from "./format";
import { STORY_STATUS_LABEL } from "./workflow";
import type { BerichtIntervall, StoryStatus } from "./types";

export type BerichtDaten = {
  firmenname: string;
  empfaengerName: string;
  von: string; // ISO-Datum
  bis: string; // ISO-Datum
  stunden: { beratung: number; entwicklung: number };
  kontingent: { gesamt: number; verbraucht: number; rest: number };
  erledigteTickets: { titel: string }[];
  abgenommeneStories: { titel: string }[];
  offeneFreigaben: { titel: string; art: "story" | "ticket"; status: string }[];
  termine: { datum: string; titel: string }[];
  portalLink: string;
};

/** Welche Berichtszeiträume sind an diesem Tag fällig? (Datum in Europe/Berlin) */
export function faelligeZeitraeume(heute: string): { intervall: Exclude<BerichtIntervall, "aus">; von: string; bis: string }[] {
  const [j, m, t] = heute.split("-").map(Number);
  const wochentag = new Date(Date.UTC(j, m - 1, t)).getUTCDay(); // 0 = Sonntag, 1 = Montag
  const ergebnis: { intervall: Exclude<BerichtIntervall, "aus">; von: string; bis: string }[] = [];
  if (wochentag === 1) {
    ergebnis.push({ intervall: "woechentlich", von: plusTage(heute, -7), bis: plusTage(heute, -1) });
  }
  if (t === 1) {
    const von = new Date(Date.UTC(j, m - 2, 1)).toISOString().slice(0, 10);
    ergebnis.push({ intervall: "monatlich", von, bis: plusTage(heute, -1) });
  }
  return ergebnis;
}

function liste(eintraege: string[], leer: string): string {
  if (!eintraege.length) return `<p style="color:#64748b;margin:4px 0 0">${esc(leer)}</p>`;
  return `<ul style="margin:4px 0 0;padding-left:20px">${eintraege.map((e) => `<li>${e}</li>`).join("")}</ul>`;
}

function abschnitt(titel: string, inhalt: string): string {
  return `<h2 style="font-size:15px;margin:24px 0 4px">${esc(titel)}</h2>${inhalt}`;
}

export function berichtErzeugen(d: BerichtDaten): { betreff: string; html: string; text: string } {
  const zeitraum = `${formatDatum(d.von)} – ${formatDatum(d.bis)}`;
  const betreff = `Ihr Bericht ${zeitraum} – ${d.firmenname}`;
  const summe = d.stunden.beratung + d.stunden.entwicklung;
  const restFarbe = d.kontingent.rest < 0 ? "#dc2626" : "#1e293b";
  const freigaben = d.offeneFreigaben.map(
    (f) => `${esc(f.titel)} <span style="color:#64748b">(${f.art === "story" ? "Story" : "Ticket"}: ${esc(f.status)})</span>`,
  );

  const html = mailLayout(
    betreff,
    `<p>Hallo ${esc(d.empfaengerName)},</p>
<p>hier ist Ihre Übersicht für <strong>${esc(d.firmenname)}</strong> im Zeitraum ${esc(zeitraum)}.</p>
${abschnitt(
  "Stunden im Zeitraum",
  `<table role="presentation" cellpadding="0" cellspacing="0" style="margin-top:4px">
<tr><td style="padding:2px 16px 2px 0">Beratung</td><td style="text-align:right">${formatStunden(d.stunden.beratung)}</td></tr>
<tr><td style="padding:2px 16px 2px 0">Entwicklung</td><td style="text-align:right">${formatStunden(d.stunden.entwicklung)}</td></tr>
<tr><td style="padding:2px 16px 2px 0;font-weight:600">Gesamt</td><td style="text-align:right;font-weight:600">${formatStunden(summe)}</td></tr>
</table>`,
)}
${abschnitt(
  "Kontingentstand",
  `<p style="margin:4px 0 0">Gebucht ${formatStunden(d.kontingent.gesamt)} · verbraucht ${formatStunden(d.kontingent.verbraucht)} · Rest <strong style="color:${restFarbe}">${formatStunden(d.kontingent.rest)}</strong></p>`,
)}
${abschnitt("Erledigte Tickets", liste(d.erledigteTickets.map((t) => esc(t.titel)), "Keine im Zeitraum."))}
${abschnitt("Abgenommene Stories", liste(d.abgenommeneStories.map((s) => esc(s.titel)), "Keine im Zeitraum."))}
${abschnitt("Wartet auf Ihre Freigabe", liste(freigaben, "Aktuell ist nichts offen."))}
${abschnitt("Termine im Zeitraum", liste(d.termine.map((t) => `${formatDatum(t.datum)} – ${esc(t.titel)}`), "Keine Termine im Zeitraum."))}
${knopf(d.portalLink, "Zum Kundenportal")}`,
  );

  const text = [
    `Hallo ${d.empfaengerName},`,
    "",
    `Ihre Übersicht für ${d.firmenname} (${zeitraum}):`,
    "",
    `Stunden: Beratung ${formatStunden(d.stunden.beratung)}, Entwicklung ${formatStunden(d.stunden.entwicklung)}, gesamt ${formatStunden(summe)}`,
    `Kontingent: gebucht ${formatStunden(d.kontingent.gesamt)}, verbraucht ${formatStunden(d.kontingent.verbraucht)}, Rest ${formatStunden(d.kontingent.rest)}`,
    "",
    "Erledigte Tickets:",
    ...(d.erledigteTickets.length ? d.erledigteTickets.map((t) => `- ${t.titel}`) : ["- keine"]),
    "",
    "Abgenommene Stories:",
    ...(d.abgenommeneStories.length ? d.abgenommeneStories.map((s) => `- ${s.titel}`) : ["- keine"]),
    "",
    "Wartet auf Ihre Freigabe:",
    ...(d.offeneFreigaben.length ? d.offeneFreigaben.map((f) => `- ${f.titel} (${f.status})`) : ["- nichts offen"]),
    "",
    "Termine:",
    ...(d.termine.length ? d.termine.map((t) => `- ${formatDatum(t.datum)} ${t.titel}`) : ["- keine"]),
    "",
    `Zum Kundenportal: ${d.portalLink}`,
  ].join("\n");

  return { betreff, html, text };
}

export function storyStatusText(s: StoryStatus): string {
  return STORY_STATUS_LABEL[s];
}
