import Phaser from 'phaser';
import type { RunResult } from './types';

/**
 * Small typed event bus connecting the Phaser game (src/scenes/) with the
 * plain HTML/CSS UI overlay (src/ui/) — title, HUD, character select,
 * jump button and the game-over dialog all live outside the canvas so
 * they stay crisp and accessible on every screen size, and talk to the
 * running scene only through these events.
 */
export interface GameEventMap {
  /** BootScene finished preloading faces + generating all textures. */
  'boot-ready': void;
  /** UI asks the game to trigger a jump (touch button or screen tap). */
  'request-jump': void;
  /** GameScene reports the current distance, several times per second. */
  'distance-update': { distanceM: number };
  /** GameScene reports that a run has ended. */
  'game-over': RunResult;
}

class TypedEventBus extends Phaser.Events.EventEmitter {
  emitTyped<K extends keyof GameEventMap>(
    event: K,
    ...args: GameEventMap[K] extends void ? [] : [GameEventMap[K]]
  ): void {
    this.emit(event as string, ...args);
  }

  onTyped<K extends keyof GameEventMap>(
    event: K,
    listener: GameEventMap[K] extends void ? () => void : (payload: GameEventMap[K]) => void
  ): this {
    return this.on(event as string, listener as (...args: unknown[]) => void);
  }
}

export const gameEvents = new TypedEventBus();
