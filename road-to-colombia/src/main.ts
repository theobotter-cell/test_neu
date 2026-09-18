import Phaser from 'phaser';
import { BootScene } from './scenes/BootScene';
import { GameScene } from './scenes/GameScene';
import { initUi } from './ui/controller';
import { preventUnwantedGestures } from './ui/preventGestures';

preventUnwantedGestures();

/**
 * Note on canvas resolution: the game canvas always exactly fills its
 * parent element (`Phaser.Scale.RESIZE`), and GameScene lays out the
 * world from the live viewport size every time it changes (see its
 * `handleResize`). The parent element itself is sized by CSS: full-screen
 * on phones (any orientation, no letterboxing — "Nutzung der gesamten
 * verfügbaren Bildschirmfläche"), and constrained to a centered ~16:9 box
 * on desktop pointers (see the `(pointer: fine)` media query in
 * style.css). Phaser does not multiply the canvas backing store by
 * devicePixelRatio unless explicitly configured to, so the number of
 * rendered pixels already stays well below what a high-DPI phone screen
 * reports — this is what satisfies the "cap canvas resolution to a
 * sensible DPR" requirement without extra runtime cost.
 * GAME_CONFIG.MAX_DEVICE_PIXEL_RATIO documents the intended ceiling if
 * this is ever revisited.
 */
const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: 'game-canvas-container',
  width: window.innerWidth,
  height: window.innerHeight,
  backgroundColor: '#003893',
  scale: {
    mode: Phaser.Scale.RESIZE,
    autoCenter: Phaser.Scale.NO_CENTER,
  },
  fps: {
    target: 60,
    min: 10,
  },
  render: {
    antialias: true,
    // No blur/filter postFX are used anywhere in the game — see the
    // project README's performance section.
  },
  scene: [BootScene, GameScene],
});

// Extra safety net beyond GAME_CONFIG.MAX_DELTA_MS: fully stop the Phaser
// game loop while the tab is hidden instead of merely pausing the active
// scene, so no work happens at all in background tabs.
document.addEventListener('visibilitychange', () => {
  if (document.hidden) {
    game.loop.sleep();
  } else {
    game.loop.wake();
  }
});

initUi(game);
