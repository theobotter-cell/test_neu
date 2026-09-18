# Road to Colombia

Ein 2D-Endless-Runner fürs Web: eine Cartoon-Figur läuft automatisch von
links nach rechts, du springst über Monster, Steine, die unheimliche
"Devil's Breath"-Pflanze und ein durchgestrichenes Visa-Dokument, und
versuchst dabei so weit wie möglich in Richtung Kolumbien zu kommen — auf
Desktop und Smartphone.

Gebaut mit **TypeScript + Vite + Phaser 3**, läuft komplett im Browser als
statische Website (kein Server, kein Backend, kein Nutzerkonto).

## Inhaltsverzeichnis

1. [Installation](#installation)
2. [Lokale Entwicklung](#lokale-entwicklung)
3. [Produktions-Build](#produktions-build)
4. [Veröffentlichung als statische Website](#veröffentlichung-als-statische-website)
5. [Gesichts-PNGs austauschen / ergänzen](#gesichts-pngs-austauschen--ergänzen)
6. [Wichtigste Konfigurationswerte](#wichtigste-konfigurationswerte)
7. [Steuerung](#steuerung)
8. [Projektstruktur](#projektstruktur)
9. [Performance-Entscheidungen](#performance-entscheidungen)

## Installation

Voraussetzung: Node.js ≥ 18.

```bash
cd road-to-colombia
npm install
```

Die vier Platzhalter-Gesichter liegen bereits fertig generiert in
`src/assets/faces/` und sind eingecheckt — `npm install` reicht zum
Starten. Falls du sie neu erzeugen/anpassen willst, siehe
[Gesichts-PNGs austauschen](#gesichts-pngs-austauschen--ergänzen).

## Lokale Entwicklung

```bash
npm run dev
```

Startet den Vite-Dev-Server (siehe Terminal-Ausgabe für die lokale URL,
i. d. R. `http://localhost:5173`) mit Hot-Reload. Zum Testen der
Touch-Steuerung/des responsiven Layouts am besten die Browser-DevTools im
Geräte-Simulationsmodus verwenden oder von einem Smartphone im selben
Netzwerk aus `http://<deine-lokale-IP>:5173` öffnen.

Weitere Befehle:

```bash
npm run typecheck   # nur TypeScript prüfen, ohne zu bauen
npm run generate:faces  # die 4 Platzhalter-Gesichter neu erzeugen (siehe unten)
```

## Produktions-Build

```bash
npm run build
```

Führt zuerst `tsc --noEmit` (Typprüfung) aus und baut danach mit Vite nach
`dist/`. Das Ergebnis ist eine vollständig statische Website (HTML, CSS,
JS, die vier Gesichts-PNGs) — keine weitere Server-Logik nötig.

Lokal prüfen, wie der Produktions-Build sich verhält:

```bash
npm run preview
```

## Veröffentlichung als statische Website

Der Inhalt von `dist/` kann auf jedem statischen Hosting deployt werden,
z. B.:

- **GitHub Pages:** `dist/`-Inhalt in den `gh-pages`-Branch (oder
  `docs/`-Ordner) pushen. `vite.config.ts` setzt bereits `base: './'`
  (relative Pfade), das Spiel läuft daher auch aus einem
  Projekt-Unterpfad (`https://user.github.io/repo/`) korrekt.
- **Netlify / Vercel / Cloudflare Pages:** Repo verbinden, Build-Befehl
  `npm run build`, Publish-Verzeichnis `dist`.
- **Beliebiger statischer Webserver / CDN / S3-Bucket:** einfach den
  kompletten Inhalt von `dist/` hochladen.

Es sind keine Umgebungsvariablen, keine Server-Rewrites und keine
Backend-Endpunkte nötig — der persönliche Bestwert wird ausschließlich im
`localStorage` des Browsers gespeichert (`src/game/storage.ts`).

## Gesichts-PNGs austauschen / ergänzen

Vollständig dokumentiert in
[`src/assets/faces/README.md`](src/assets/faces/README.md). Kurzfassung:

- Ordner: `src/assets/faces/`
- Dateinamen: `face_1.png` … `face_4.png` (referenziert in
  `src/game/characters.ts`)
- Format: PNG mit transparentem Hintergrund, **256 × 256 px**,
  quadratisch, Frontalansicht, Gesicht zentriert und ca. 65–80 % der
  Bildfläche ausfüllend
- Ersetzen: Datei mit demselben Namen überschreiben — fertig, kein
  Code-Change nötig.
- Neue Figur ergänzen: neue PNG-Datei ablegen (z. B. `face_5.png`) und in
  `src/game/characters.ts` einen neuen Eintrag im `CHARACTERS`-Array
  hinzufügen (Datei-Erkennung läuft automatisch über
  `import.meta.glob`, siehe `src/game/faces.ts`).

Die vier aktuellen Platzhalter sind selbst generiert — keine externen
Bilddateien, keine Lizenzfragen. Das Erzeugungsskript liegt unter
`scripts/generate-placeholder-faces.mjs` (`npm run generate:faces`).

## Wichtigste Konfigurationswerte

Alle Spielwerte sind zentral in [`src/game/config.ts`](src/game/config.ts)
mit Begründung kommentiert. Die wichtigsten:

| Wert | Bedeutung |
|---|---|
| `BASE_WIDTH` / `BASE_HEIGHT` | Referenzauflösung (16:9); die tatsächliche Spielfläche wird live an die Bildschirmgröße angepasst (siehe `GameScene.layout()`). |
| `GRAVITY_Y` / `JUMP_VELOCITY` | Steuern die Sprungkurve (Fallbeschleunigung / Sprungkraft). |
| `BASE_SCROLL_SPEED` / `MAX_SCROLL_SPEED` | Lauftempo der Welt zu Beginn bzw. bei maximaler Schwierigkeit. |
| `DIFFICULTY_DISTANCE_SCALE_M` | Über wie viele Meter die Schwierigkeit von 0 auf 1 ansteigt (Tempo, Spawn-Frequenz, Hindernis-Vielfalt hängen alle an diesem Wert). |
| `SPAWN_GAP_SECONDS` / `ABSOLUTE_MIN_SPAWN_GAP_SECONDS` | Zeitlicher Mindest-/Höchstabstand zwischen Hindernissen — bewusst so gewählt, dass bei jeder Geschwindigkeit genug Reaktionszeit zum Springen bleibt. |
| `PLAYER_HITBOX_WIDTH/HEIGHT` | Kollisionsbox der Spielfigur (kleiner als die Grafik, für faires Gameplay). |
| `MAX_DELTA_MS` | Kappt einen einzelnen Simulationsschritt, damit ein Tabwechsel/Pause keinen Zeitsprung verursacht. |

Hindernis-spezifische Werte (Größe, Kollisionsbox, Spawn-Gewichtung,
Freischalt-Distanz) stehen in
[`src/game/obstacles.ts`](src/game/obstacles.ts), Charaktere/Farbpaletten
in [`src/game/characters.ts`](src/game/characters.ts).

## Steuerung

- **Desktop:** Leertaste, Pfeiltaste ↑ oder W zum Springen
- **Smartphone/Tablet:** Antippen des Spielfelds oder der großen
  SPRUNG-Schaltfläche unten rechts
- Scrollen, Zoomen und Text-Markieren sind während des Spiels unterbunden
  (siehe `src/style.css` und `src/ui/preventGestures.ts`)

## Projektstruktur

```
road-to-colombia/
├── index.html              # Einstiegspunkt, HTML-UI-Grundgerüst
├── scripts/
│   └── generate-placeholder-faces.mjs   # erzeugt die 4 Platzhalter-Gesichter
├── src/
│   ├── main.ts              # Phaser-Game-Setup, UI-Init, Gesten-Schutz
│   ├── style.css            # gesamtes UI-Styling, responsives Layout
│   ├── game/
│   │   ├── config.ts         # zentrale Spielwerte (siehe oben)
│   │   ├── characters.ts     # Figuren-Definitionen (Startszenen-Konfig)
│   │   ├── obstacles.ts      # Hindernis-Definitionen + Spawn-/Schwierigkeitslogik
│   │   ├── textures.ts       # prozedurale Vektor-Grafiken (Körper, Hindernisse, Boden)
│   │   ├── faces.ts          # lädt/liefert die Gesichts-PNG-URLs
│   │   ├── storage.ts        # Bestwert-Persistenz (localStorage)
│   │   ├── events.ts         # Event-Bus zwischen Phaser-Szene und HTML-UI
│   │   └── types.ts          # gemeinsame TypeScript-Typen
│   ├── scenes/
│   │   ├── BootScene.ts      # lädt Assets, generiert Texturen
│   │   └── GameScene.ts      # Hauptspiel: Physik, Spawning, Kollision, Distanz
│   ├── ui/
│   │   ├── controller.ts     # Start-/Auswahlbildschirm, HUD, Game-Over-Dialog
│   │   └── preventGestures.ts
│   └── assets/
│       ├── faces/            # die 4 austauschbaren Gesichts-PNGs (+ README)
│       ├── characters/       # README: warum Körper prozedural statt PNG sind
│       └── obstacles/        # README: warum Hindernisse prozedural statt PNG sind
└── public/
```

Die Trennung entspricht den Vorgaben: Start-/Auswahlszene
(`src/ui/controller.ts` + `index.html`), Hauptspiel (`GameScene.ts`),
Game-Over-Zustand (Dialog in `controller.ts`, ausgelöst über
`src/game/events.ts`), Figuren-Konfiguration (`characters.ts`),
Hindernis-Konfiguration (`obstacles.ts`), Asset-Laden (`BootScene.ts`,
`faces.ts`), Bestwert-Speicherung (`storage.ts`).

## Performance-Entscheidungen

- **Keine großen Hintergrundbilder:** Der Colombia-Hintergrund (Flagge)
  ist aus drei flachen Rechtecken gezeichnet, der Boden ist ein 64 px
  breites, wiederholtes Tile — beides zusammen wiegt praktisch nichts.
- **Alle Körper/Hindernisse sind Vektorgrafik**, einmalig beim Boot als
  Textur gebacken (`src/game/textures.ts`) statt als Bilddateien geladen
  — kleine Bundle-Größe, keine Bild-Downloads/Decodes zur Laufzeit.
- **Canvas-Auflösung:** Das Spiel rendert exakt in CSS-Pixelgröße seines
  Containers (`Phaser.Scale.RESIZE`) statt mit
  `devicePixelRatio`-Multiplikator — das hält die tatsächliche
  Pixelzahl auch auf hochauflösenden Smartphones niedrig (siehe
  Kommentar in `src/main.ts`).
- **Kein Blur/Filter-Postprocessing** irgendwo im Spiel.
- **Objekt-Bereinigung:** Hindernisse werden zerstört, sobald sie den
  Bildschirm verlassen (`GameScene.updateObstacles`).
- **Delta-Time-Kappung:** `GAME_CONFIG.MAX_DELTA_MS` verhindert einen
  Physik-/Spawn-Sprung nach einer Verzögerung; zusätzlich wird die
  gesamte Phaser-Loop bei verstecktem Tab komplett schlafen gelegt
  (`document.visibilitychange` in `main.ts`, Szene pausiert zusätzlich
  in `GameScene`).

## Getestet mit

Automatisierte Rauchtests (Playwright/Chromium) für Desktop, iPhone-Portrait
und -Landscape: Charakterauswahl, Start, Tastatur-Sprung, Touch-Sprung
(Button + Antippen des Spielfelds), Kollision → Game-Over-Dialog mit exaktem
Text „Es isch geisteskrank“, Rekord-Speicherung, „NOCHMAL“ und „Figur
wechseln“ — ohne JavaScript-Fehler in der Konsole.
