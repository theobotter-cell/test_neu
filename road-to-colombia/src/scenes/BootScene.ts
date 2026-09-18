import Phaser from 'phaser';
import { CHARACTERS } from '../game/characters';
import { faceTextureKey, getFaceUrl } from '../game/faces';
import { GAME_CONFIG } from '../game/config';
import { generateAllTextures } from '../game/textures';
import { gameEvents } from '../game/events';

/**
 * Loads the four face PNGs and generates every procedural texture (bodies,
 * obstacles, ground) exactly once. Nothing is visible while this scene
 * runs — the HTML character-select screen (see src/ui/) is shown on top
 * of the canvas until the player presses Start.
 */
export class BootScene extends Phaser.Scene {
  constructor() {
    super('BootScene');
  }

  preload(): void {
    for (const character of CHARACTERS) {
      this.load.image(faceTextureKey(character.id), getFaceUrl(character.facePath));
    }
  }

  create(): void {
    generateAllTextures(this, GAME_CONFIG.GROUND_HEIGHT);
    gameEvents.emitTyped('boot-ready');
  }
}
