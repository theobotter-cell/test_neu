# Hindernis-Grafiken (`src/assets/obstacles/`)

Wie bei den Charakter-Körpern (siehe `src/assets/characters/README.md`)
werden auch alle Hindernisse **prozedural als Vektorgrafik** gezeichnet und
als Textur zwischengespeichert – siehe `src/game/textures.ts` und die
Hindernis-Definitionen in `src/game/obstacles.ts`. Das hält das Spiel auch
auf älteren Smartphones flüssig, weil keine zusätzlichen Bilder geladen
werden müssen.

## Enthaltene Hindernistypen

Definiert in `src/game/obstacles.ts` (dort auch mit Kommentaren zu
Kollisionsfläche, Spawn-Gewichtung und Mindestabstand):

- **Monster A/B/C** – drei unterschiedliche Cartoon-Monster
- **Stein** – einfacher Fels-Cartoon
- **Devil's Breath** – unheimliche Engelstrompeten-Pflanze mit
  weiß-gelben Trompetenblüten und leichtem giftigem Nebel
- **Visa-Dokument** – generisches, fiktives Reisedokument mit großem rotem
  Verbotssymbol; **enthält bewusst keine echten Behördenlogos, Staatswappen
  oder Marken** – Farben und Form sind rein generisch gehalten.

## Eigene Sprite-Grafiken statt Vektor-Hindernisse verwenden

Optional, falls du echte PNG-Illustrationen statt der Vektor-Hindernisse
einsetzen willst:

1. Transparente PNGs hier ablegen (z. B. `monster_a.png`, `rock.png`, …).
   Empfehlung: 128×128 px, Motiv zentriert, klarer Cartoon-Stil mit dunklen
   Konturen, gut erkennbar auch auf kleinen Bildschirmen.
2. In `src/scenes/BootScene.ts` per `this.load.image(key, url)` laden.
3. In `src/game/textures.ts` den jeweiligen `buildObstacleTexture(...)`-Fall
   durch den geladenen Textur-Key ersetzen (oder in
   `src/game/obstacles.ts` das `textureKey`-Feld direkt auf deinen eigenen
   Key umbiegen).

Das ist optional – die prozeduralen Platzhalter erfüllen bereits alle
Abnahmekriterien (klarer Cartoon-Stil, faire Kollisionsflächen, gute
Erkennbarkeit auf kleinen Bildschirmen).
