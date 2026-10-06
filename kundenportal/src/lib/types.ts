/** Domänentypen entsprechend den Supabase-Migrationen */

export type Rolle = "admin" | "berater" | "customer_success" | "kunde";
export type BerichtIntervall = "woechentlich" | "monatlich" | "aus";
export type StoryStatus =
  | "entwurf"
  | "zur_schaetzung_freigegeben"
  | "geschaetzt"
  | "zur_umsetzung_freigegeben"
  | "in_umsetzung"
  | "zur_abnahme"
  | "abgenommen";
export type TicketTyp = "fehler" | "frage" | "aenderungswunsch" | "aufgabe";
export type TicketPrioritaet = "niedrig" | "normal" | "hoch" | "kritisch";
export type TicketStatus = "neu" | "in_arbeit" | "wartet_auf_kunde" | "erledigt";
export type ZeitKategorie = "beratung" | "entwicklung";

export type Profil = {
  id: string;
  name: string;
  email: string;
  rolle: Rolle;
  buchungslink: string | null;
  aktiv: boolean;
  created_at: string;
};

export type Kunde = {
  id: string;
  firmenname: string;
  kunde_user_id: string | null;
  hauptberater_id: string | null;
  bericht_intervall: BerichtIntervall;
  bitrix_company_id: string | null;
  created_at: string;
};

export type Kontingent = {
  id: string;
  customer_id: string;
  leistung: string;
  gebucht_am: string;
  stunden: string;
  betrag: string | null;
  bitrix_deal_id: string | null;
};

export type KontingentStand = {
  customer_id: string;
  gesamt: string;
  verbraucht_beratung: string;
  verbraucht_entwicklung: string;
  verbraucht: string;
  rest: string;
};

export type Story = {
  id: string;
  customer_id: string;
  titel: string;
  beschreibung: string;
  akzeptanzkriterien: string;
  status: StoryStatus;
  schaetzung_stunden: string | null;
  position: number;
  erstellt_von: string | null;
  ticket_id: string | null;
  status_seit: string;
  created_at: string;
  updated_at: string;
};

export type Ticket = {
  id: string;
  customer_id: string;
  titel: string;
  beschreibung: string;
  typ: TicketTyp;
  prioritaet: TicketPrioritaet;
  status: TicketStatus;
  zustaendig_id: string | null;
  faellig_am: string | null;
  erstellt_von: string | null;
  story_id: string | null;
  status_seit: string;
  created_at: string;
  updated_at: string;
};

export type Zeit = {
  id: string;
  customer_id: string;
  erfasst_von: string | null;
  datum: string;
  dauer_stunden: string;
  beschreibung: string;
  kategorie: ZeitKategorie;
  abrechenbar: boolean;
  story_id: string | null;
  ticket_id: string | null;
  bitrix_task_id: string | null;
  created_at: string;
};

export type Kommentar = {
  id: string;
  customer_id: string;
  story_id: string | null;
  ticket_id: string | null;
  autor_id: string | null;
  autor_rolle: Rolle | null;
  text: string;
  created_at: string;
};

export type Approval = {
  id: string;
  customer_id: string;
  story_id: string;
  aktion: string;
  von_status: StoryStatus | null;
  nach_status: StoryStatus;
  user_id: string | null;
  kommentar: string | null;
  created_at: string;
};

export type Termin = {
  id: string;
  customer_id: string;
  datum: string;
  titel: string;
  berater_id: string | null;
  transkript: string | null;
  transkript_datei: string | null;
  created_at: string;
};

export type Monatsabschluss = {
  id: string;
  customer_id: string;
  monat: string;
  status: "offen" | "abgeschlossen";
  abgeschlossen_von: string | null;
  abgeschlossen_am: string | null;
};

export type Benachrichtigung = {
  id: string;
  user_id: string;
  typ: string;
  text: string;
  link: string | null;
  gelesen: boolean;
  created_at: string;
};

export type KundenKennzahlen = {
  customer_id: string;
  firmenname: string;
  hauptberater_id: string | null;
  gesamt: string;
  verbraucht: string;
  rest: string;
  rest_prozent: string | null;
  offene_stories: number;
  offene_tickets: number;
  wartet_auf_kunde: number;
  wartet_auf_berater: number;
  wartet_beim_kunden_seit: string | null;
  letzte_aktivitaet: string | null;
  letzte_ablehnung_am: string | null;
};

/** Ergebnis von Server Actions für Formulare */
export type AktionErgebnis = { ok: true; meldung?: string } | { ok: false; fehler: string } | null;
