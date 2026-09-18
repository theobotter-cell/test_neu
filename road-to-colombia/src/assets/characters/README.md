# Charakter-Körper (`src/assets/characters/`)

Dieser Ordner ist bewusst (fast) leer. Die **Körper** der Spielfiguren
(Stehen, Laufen Phase 1/2, Springen, Kollision) werden **prozedural als
Vektorgrafik** erzeugt – siehe `src/game/textures.ts` – statt als
Sprite-PNGs geladen zu werden.

## Warum prozedural statt PNG-Spritesheets?

- **Performance:** keine zusätzlichen Bild-Downloads/Decodes, winzige
  Bundle-Größe, ideal für ältere Smartphones (siehe Performance-Vorgaben im
  README des Projekts).
- **Konsistenz:** alle vier Figuren teilen sich dieselbe Animationslogik und
  nur die Farbpalette (`bodyPalette` in `src/game/characters.ts`) sowie das
  Gesicht unterscheiden sich – das hält den Cartoon-Stil einheitlich.
- **Trennung von Kopf und Körper:** Der Körper hat bewusst *keinen* Kopf/
  Gesicht eingezeichnet. Das jeweilige Gesichts-PNG aus
  `src/assets/faces/` wird separat als eigenes Game-Object über dem Hals
  positioniert (siehe `Player` in `src/scenes/GameScene.ts`). So bleibt der
  Tausch eines Gesichts unabhängig vom Körper.

## Eigene Sprite-Grafiken statt Vektor-Körper verwenden

Falls du echte Spritesheet-PNGs statt der prozeduralen Körper verwenden
willst:

1. Lege deine Frames hier ab (z. B. `run_1.png`, `run_2.png`, `jump.png`,
   `stand.png`, `hit.png`), transparenter Hintergrund, gleiche Canvasgröße
   für alle Frames, Kopf-/Halsbereich oben in jedem Frame an derselben
   Position (damit das Gesicht weiterhin passt).
2. Lade sie in `src/scenes/BootScene.ts` zusätzlich per
   `this.load.image(key, url)` und ersetze in `src/game/textures.ts` bzw.
   `buildCharacterFrameKeys(...)` die zurückgegebenen Textur-Keys durch
   deine eigenen Keys.

Das ist optional – die prozeduralen Platzhalter sind voll funktionsfähig und
müssen für die Abnahme des Spiels nicht ersetzt werden.
