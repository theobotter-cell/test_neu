# Gesichts-Assets (`src/assets/faces/`)

Dieser Ordner enthält **nur die Gesichter** der Spielfiguren. Der Körper
(Laufanimation, Sprung, Kollision) wird getrennt davon prozedural gezeichnet
(siehe `src/game/textures.ts` und `src/assets/characters/README.md`) – so
kannst du ein Gesicht austauschen, ohne irgendetwas an der Animation oder
Kollisionslogik anzufassen.

## Aktuelle Dateien (Platzhalter)

| Datei | Figur | Verwendet in |
|---|---|---|
| `face_1.png` | Sol | `src/game/characters.ts` → Charakter `sol` |
| `face_2.png` | Mango | `src/game/characters.ts` → Charakter `mango` |
| `face_3.png` | Nube | `src/game/characters.ts` → Charakter `nube` |
| `face_4.png` | Café | `src/game/characters.ts` → Charakter `cafe` |

Diese vier PNGs sind **rein programmatisch erzeugte Platzhalter** (siehe
`scripts/generate-placeholder-faces.mjs`, keine externen Bilddateien, keine
Abhängigkeiten von Dritten). Sie zeigen vier frei erfundene, unterschiedliche
Cartoon-Gesichter (verschiedene Hauttöne, Frisuren, Accessoires) und können
jederzeit 1:1 durch eigene Kunst ersetzt werden.

## Vorgaben für eigene Ersatzbilder

- **Format:** PNG mit transparentem Hintergrund (Alpha-Kanal)
- **Größe:** 256 × 256 px (quadratisch). Größere Bilder funktionieren auch,
  werden aber zur Laufzeit auf die Kopf-Zielgröße skaliert – quadratisch
  bleibt trotzdem Pflicht, sonst wird das Gesicht verzerrt.
- **Ausrichtung:** Frontalansicht, Blick nach rechts/geradeaus (die Figur
  läuft nach rechts). Das Gesicht sollte ca. 65–80 % der Bildhöhe/-breite
  ausfüllen und **vertikal/horizontal zentriert** sein, damit es exakt auf
  den Körper-Hals-Ansatz passt.
- **Stil:** Kräftiger, gut lesbarer Cartoon-Stil mit dunklen Konturen –
  passend zum restlichen Spiel (siehe restliche Platzhalter als Referenz).
  Auch auf kleinen Smartphone-Bildschirmen muss das Gesicht klar erkennbar
  bleiben (keine feinen Details, hoher Kontrast).
- **Dateiname:** exakt wie oben in der Tabelle (`face_1.png` … `face_4.png`),
  sonst muss zusätzlich `src/game/characters.ts` angepasst werden.

## Ersetzen eines Gesichts

1. Eigene PNG-Datei mit exakt demselben Dateinamen in diesen Ordner legen
   (z. B. `face_1.png` überschreiben).
2. Fertig – `src/game/characters.ts` referenziert die Datei bereits über
   ihren Namen, es ist keine weitere Code-Änderung nötig.

## Weitere Personen/Figuren ergänzen

1. Neue PNG-Datei nach obigen Vorgaben in diesen Ordner legen, z. B.
   `face_5.png`.
2. In `src/game/characters.ts` einen neuen Eintrag im `CHARACTERS`-Array
   hinzufügen (eindeutige `id`, `name`, `facePath: 'face_5.png'`, sowie eine
   Körper-Farbpalette). Ein Kommentar direkt über dem Array erklärt jedes
   Feld.
3. Kein weiterer Code muss angefasst werden – die Charakterauswahl-UI und
   der Body-Textur-Generator lesen die Liste automatisch aus.

## Platzhalter neu erzeugen

Der Platzhalter-Generator kann jederzeit erneut ausgeführt werden (z. B. nach
Anpassungen im Skript, um mit den Formen zu experimentieren):

```bash
npm run generate:faces
```
