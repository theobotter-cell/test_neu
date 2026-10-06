# Linxys Kundenportal

Eigenständiges Kundenportal der Linxys Bitrix24-Beratung. Löst die bisherige
„Supportaufgabe“ in Bitrix24 ab: Board mit Story-Workflow und Tickets,
Zeiterfassung mit Kontingenten, Termine mit Transkripten, Dashboards,
Benachrichtigungen, periodische Berichte und interner Monatsabschluss.

**Stack:** Next.js 16 (App Router, TypeScript) · Supabase (Auth, Postgres, Storage, RLS) ·
Tailwind CSS 4 + shadcn/ui · Vercel (fra1) · E-Mail über austauschbaren Anbieter (Resend).

Das MVP hat **keine** Schnittstelle zu Bitrix24. Felder für spätere Bitrix-IDs
(`bitrix_company_id`, `bitrix_deal_id`, `bitrix_task_id`) existieren als reiner Text.

---

## Inhalt

1. [Architektur & Sicherheit](#architektur--sicherheit)
2. [Lokale Entwicklung](#lokale-entwicklung)
3. [Tests](#tests)
4. [Deployment (Produktion)](#deployment-produktion)
5. [Betrieb](#betrieb)
6. [Projektstruktur](#projektstruktur)

---

## Architektur & Sicherheit

Sicherheit hat höchste Priorität. Die Datenbank ist die maßgebliche Instanz –
die Oberfläche blendet Unerlaubtes nur aus.

| Prinzip | Umsetzung |
|---|---|
| Row Level Security | auf **allen** Tabellen und dem Storage-Bucket `transkripte` (`supabase/migrations/…_rechte.sql`, `…_storage.sql`) |
| Rollenprüfung | ausschließlich serverseitig über `app.aktuelle_rolle()` aus `profiles` (nie aus JWT-Metadaten oder Client-Daten); Hilfsfunktionen im nicht exponierten Schema `app` |
| Mandantentrennung | `app.darf_lesen / darf_bearbeiten / darf_mitwirken(customer_id)`; `customer_id` ist nach dem Anlegen unveränderlich; Verknüpfungen (Story/Ticket ↔ Zeit/Kommentar) müssen zum selben Kunden gehören |
| Story-Status | nur über `story_transition()` (prüft Rolle, Übergang, Pflichtangaben, schreibt `approvals` im selben Vorgang). Direktes `UPDATE status` ist per Spaltenrecht **und** Trigger gesperrt |
| Protokolle | `approvals` und `audit_log`: nur INSERT, UPDATE/DELETE/TRUNCATE per Trigger für niemanden möglich |
| Monatsabschluss | Zeiten abgeschlossener Monate sind per Trigger für **alle** gesperrt; nur admin öffnet wieder (`monat_wiedereroeffnen`, protokolliert) |
| Service-Role-Key | nur serverseitig (`src/lib/supabase/admin.ts`, `server-only`): Auth-Administration (Einladen/Sperren) und Cron-Jobs |
| Deaktivierte Logins | `aktiv = false` ⇒ keine Rolle ⇒ kein Zugriff; zusätzlich Sperre in Supabase Auth |
| Benachrichtigungen | per Datenbank-Trigger erzeugt (In-App + E-Mail-Warteschlange `email_outbox`), nie im Browser |

**Rollen:** `admin` (alles), `berater` (nur zugeordnete Kunden), `customer_success`
(alle Kunden lesend), `kunde` (genau ein Login pro Kunde, nur eigene Daten).
Keine öffentliche Registrierung – Nutzer werden vom admin eingeladen.

---

## Lokale Entwicklung

Voraussetzungen: Node.js ≥ 20.9, Docker, Supabase CLI (als devDependency enthalten).

```bash
cd kundenportal
npm install
npx supabase start            # startet Supabase lokal, spielt Migrationen + seed.sql ein
cp .env.example .env.local    # Werte aus "npx supabase status" eintragen (API URL, anon key, service_role key)
npm run dev                   # http://localhost:3000
```

E-Mails landen lokal im Server-Log (`MAIL_PROVIDER=konsole`), Supabase-Auth-Mails in Mailpit
(http://127.0.0.1:54324).

### Test-Logins (seed.sql, Passwort für alle: `Linxys2026!`)

| E-Mail | Rolle |
|---|---|
| admin@linxys.test | admin |
| anna.berger@linxys.test | berater (Hauptberaterin Muster Handels GmbH, mit Buchungslink) |
| tom.keller@linxys.test | berater (Hauptberater Beispiel Logistik AG, zusätzlich bei Muster Handels) |
| cs@linxys.test | customer_success |
| kunde@muster-handel.test | kunde – Muster Handels GmbH (≈ 87 % Kontingent verbraucht) |
| kunde@beispiel-logistik.test | kunde – Beispiel Logistik AG |

Die Seed-Daten enthalten Stories in allen Status, Tickets, Zeiten über vier Monate,
Termine mit Transkripten und einen abgeschlossenen Monat.

### Datenbankänderungen

Ausschließlich über Migrationen:

```bash
npx supabase migration new <name>   # SQL in supabase/migrations/ schreiben
npx supabase db reset               # lokal neu aufsetzen (Migrationen + Seed)
npm run test:rls                    # RLS-Tests müssen grün bleiben
```

---

## Tests

| Befehl | Inhalt |
|---|---|
| `npm test` | Unit-Tests (Formatierung, CSV, Monatsprüfung, Workflow-Spiegel, CS-Ampel, Bericht) |
| `npm run test:rls` | RLS- und Workflow-Tests gegen eine laufende Datenbank (`DATABASE_URL`, Standard: lokales Supabase auf Port 54322) |
| `npm run test:rls:lokal` | dieselben Tests **ohne Docker**: startet einen temporären Postgres mit Supabase-Stub (`tests/support/supabase-stub.sql`) |
| `npm run lint`, `npm run typecheck` | ESLint, TypeScript |

Die RLS-Tests (`tests/rls/`) prüfen mit zwei Testkunden, dass Kunde A – und ein Berater
ohne Zuordnung – keinerlei Daten von Kunde B lesen oder schreiben kann (Stories, Tickets,
Zeiten, Kommentare, Termine, Transkript-Dateien, Kontingente, Views, RPCs), sowie
Rollenrechte, gesperrte Monate, unveränderliche Protokolle, den Story-Workflow,
Kontingentwarnungen und den Ansprechpartnerwechsel. `tests/rls/api.test.ts` prüft die
Trennung zusätzlich über die echte Supabase-API (Auth, PostgREST, Storage).

Die GitHub Action `.github/workflows/kundenportal.yml` führt bei jeder Änderung Lint,
Typecheck, Unit-Tests, Build sowie alle RLS-/API-Tests gegen ein frisch gestartetes
Supabase aus.

---

## Deployment (Produktion)

### 1. Supabase-Projekt (Region Frankfurt)

1. Neues Projekt anlegen, **Region: Central EU (Frankfurt) – eu-central-1**.
2. Migrationen einspielen (nicht den Seed!):
   ```bash
   npx supabase link --project-ref <ref>
   npx supabase db push
   ```
3. **Authentication › Providers › Email:** „Allow new users to sign up“ **deaktivieren**.
   Mindestpasswortlänge 10, Anforderungen „Buchstaben und Ziffern“.
4. **Authentication › URL Configuration:** Site URL = Produktions-URL,
   Redirect URL `https://<domain>/auth/confirm` hinzufügen.
5. **Authentication › Email Templates:** Inhalte aus `supabase/templates/einladung.html`
   (Invite) und `supabase/templates/passwort.html` (Reset Password) übernehmen.
6. **Authentication › SMTP:** eigenen SMTP-Server mit EU-Region hinterlegen
   (z. B. Resend SMTP, EU-Region), damit Einladungen zuverlässig zugestellt werden.
7. Ersten admin anlegen: Nutzer unter Authentication › Users einladen, dann im SQL-Editor:
   ```sql
   insert into public.profiles (id, name, email, rolle)
   select id, 'Vorname Nachname', email, 'admin' from auth.users where email = 'admin@linxys.de';
   ```
   Alle weiteren Nutzer und Kunden legt der admin im Portal unter **Verwaltung** an.

### 2. Vercel

1. Projekt importieren, **Root Directory: `kundenportal`**.
2. **Function Region: Frankfurt (fra1)** – ist in `vercel.json` gesetzt.
3. Umgebungsvariablen (siehe `.env.example`):

   | Variable | Hinweis |
   |---|---|
   | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` | öffentlich |
   | `SUPABASE_SERVICE_ROLE_KEY` | **geheim**, nur serverseitig, niemals mit `NEXT_PUBLIC_` |
   | `APP_URL` | z. B. `https://portal.linxys.de` (Links in E-Mails) |
   | `CRON_SECRET` | zufälliger langer Wert; Vercel sendet ihn automatisch an die Cron-Endpunkte |
   | `MAIL_PROVIDER=resend`, `RESEND_API_KEY`, `MAIL_FROM` | Resend-Projekt/Domain in der **EU-Region** anlegen |

4. Cron-Jobs (`vercel.json`):
   - `/api/cron/emails` alle 5 Minuten – versendet die E-Mail-Warteschlange
   - `/api/cron/berichte` täglich 05:00 UTC – montags Wochen-, am 1. Monatsberichte

   Hinweis: Minütliche/5-Minuten-Crons erfordern Vercel Pro. Alternativ können beide
   Endpunkte per Supabase `pg_cron` + `pg_net` aufgerufen werden
   (Header `Authorization: Bearer <CRON_SECRET>`).

### 3. E-Mail-Anbieter wechseln

`src/lib/email/provider.ts` kapselt den Versand hinter dem Interface `MailProvider`.
Für einen anderen Anbieter eine Klasse ergänzen und in `mailProvider()` registrieren.

---

## Betrieb

- **Kontingentwarnungen** (80 % / 100 %) entstehen per Trigger beim Erfassen von Zeiten
  bzw. Ändern von Kontingenten; jede Schwelle wird einmal gemeldet und zurückgesetzt,
  sobald der Verbrauch wieder darunter fällt. Schwellen: `app.kontingent_schwellen()`.
- **Customer-Success-Schwellen** (20 %, 21 Tage, 7 Tage, 30 Tage): `src/lib/config.ts`.
- **Monatsabschluss:** Berater prüft unter Kunde › Monatsabschluss (Prüfhinweise:
  fehlende Beschreibung, Tage > 10 h, Entwicklung ohne Story/Ticket), schließt ab und
  lädt den CSV-Export für die Rechnungsstellung. Nur admin kann wieder öffnen (Grund Pflicht,
  Audit-Log).
- **Ansprechpartner wechseln:** Verwaltung › Kunden › Kunde: neuer Login wird eingeladen,
  der alte deaktiviert und in Supabase Auth gesperrt (Audit-Log).
- **Bericht nachholen:** `GET /api/cron/berichte?datum=JJJJ-MM-TT` mit Cron-Secret
  (idempotent pro Kunde und Zeitraum).
- **E-Mail-Fehler:** fehlgeschlagene Mails werden bis zu 5-mal erneut versucht
  (`email_outbox.status = 'fehler'`, Spalte `fehler`).

---

## Projektstruktur

```
kundenportal/
├── supabase/
│   ├── migrations/      Datenmodell, Rechte/RLS, Workflows, Views, Storage, Berichte
│   ├── templates/       deutsche Auth-E-Mail-Vorlagen
│   └── seed.sql         Testdaten
├── src/
│   ├── app/
│   │   ├── (portal)/    angemeldeter Bereich: Dashboards, /k/[cid]/…, Zeiterfassung, Verwaltung
│   │   ├── api/cron/    E-Mail-Versand, periodische Berichte
│   │   └── auth/, login/, passwort-*/
│   ├── components/      UI (shadcn/ui-Basis in components/ui), Board (dnd-kit)
│   ├── lib/
│   │   ├── aktionen/    Server Actions (alle Schreibzugriffe, RLS-geschützt)
│   │   ├── email/       Anbieter-Abstraktion, Vorlagen, Outbox-Versand
│   │   ├── supabase/    Clients (Server/Browser/Admin) und Session-Proxy
│   │   └── …            Formatierung, Workflow-Spiegel, CSV, Prüfungen, Bericht
│   └── proxy.ts         Session-Erneuerung, Login-Weiterleitung
├── tests/
│   ├── rls/             RLS-, Workflow- und API-Tests
│   └── unit/
└── scripts/             Datenbank ohne Docker für Tests
```

### Bewusst nicht im MVP

Bitrix24-Synchronisation (Phase 2), Dateianhänge an Stories/Tickets, Kalender-/Calendly-
Integration, KI-Zusammenfassungen, PDF-Exporte, mehrere Logins pro Kunde.
