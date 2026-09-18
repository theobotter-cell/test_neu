import Phaser from 'phaser';
import { GAME_CONFIG } from '../game/config';
import { getCharacterById } from '../game/characters';
import { faceTextureKey } from '../game/faces';
import { bodyTextureKey, BODY_TEXTURE_SIZE, GROUND_TILE_KEY, type BodyPose } from '../game/textures';
import { getObstacleHitbox, getScrollSpeed, nextSpawnDelaySeconds, pickObstacle } from '../game/obstacles';
import { recordRunResult, setLastCharacterId } from '../game/storage';
import { gameEvents } from '../game/events';
import type { CharacterDefinition, ObstacleDefinition, PlayerState } from '../game/types';

export interface GameSceneData {
  characterId: string;
}

interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

function rectsOverlap(a: Rect, b: Rect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

/** Colombian-flag-style background: yellow top half, blue next quarter,
 * red bottom quarter — drawn once as three flat rectangles (no image
 * asset), per the project's performance requirements. Resized live to
 * whatever the current viewport is (see `layout()`). */
const FLAG_COLORS = { yellow: 0xfcd116, blue: 0x003893, red: 0xce1126 };

export class GameScene extends Phaser.Scene {
  private character!: CharacterDefinition;

  private playerContainer!: Phaser.GameObjects.Container;
  private bodyImage!: Phaser.GameObjects.Image;
  private faceImage!: Phaser.GameObjects.Image;
  private groundTile!: Phaser.GameObjects.TileSprite;
  private bgYellow!: Phaser.GameObjects.Rectangle;
  private bgBlue!: Phaser.GameObjects.Rectangle;
  private bgRed!: Phaser.GameObjects.Rectangle;

  private playerState: PlayerState = 'standing';
  private playerFeetY = 0;
  private playerVelocityY = 0;
  private groundY = 0;
  private playerX = 0;
  private viewWidth: number = GAME_CONFIG.BASE_WIDTH;

  private distancePx = 0;
  private scrollSpeed = 0;
  private isRunStarted = false;
  private isGameOver = false;

  private obstacles: Phaser.GameObjects.Image[] = [];
  private spawnTimerSeconds = 0;
  private runFrameTimerMs = 0;
  private runFrameToggle = false;

  // Stable references so repeated scene restarts never accumulate
  // duplicate listeners on long-lived objects that Phaser does NOT tear
  // down between scene restarts (the global event bus, the document, and
  // the game-wide Scale Manager — unlike e.g. the input plugin, these are
  // not reset for us).
  private readonly handleJumpRequest = (): void => this.tryJump();
  private readonly handleVisibilityChange = (): void => {
    if (document.hidden) {
      if (this.scene.isActive()) this.scene.pause();
    } else if (this.scene.isPaused()) {
      this.scene.resume();
    }
  };
  private readonly handleResize = (gameSize: Phaser.Structs.Size): void => {
    this.layout(gameSize.width, gameSize.height);
  };

  constructor() {
    super('GameScene');
  }

  get distanceM(): number {
    return this.distancePx / GAME_CONFIG.PIXELS_PER_METER;
  }

  create(data: GameSceneData): void {
    this.character = getCharacterById(data.characterId);
    setLastCharacterId(this.character.id);

    // Reset all per-run state (the Scene object itself is reused across
    // restarts, so nothing may be left over from a previous run).
    this.playerState = 'standing';
    this.playerVelocityY = 0;
    this.distancePx = 0;
    this.scrollSpeed = 0;
    this.isRunStarted = false;
    this.isGameOver = false;
    this.obstacles = [];
    this.spawnTimerSeconds = 0;
    this.runFrameTimerMs = 0;
    this.runFrameToggle = false;

    this.buildSceneObjects();
    this.layout(this.scale.width, this.scale.height);

    this.spawnTimerSeconds = nextSpawnDelaySeconds(0);

    // Keyboard: Space / ArrowUp / W. Phaser tears down and rebuilds the
    // input plugin on every scene shutdown/restart, so these listeners
    // never need manual removal.
    this.input.keyboard?.addCapture([
      Phaser.Input.Keyboard.KeyCodes.SPACE,
      Phaser.Input.Keyboard.KeyCodes.UP,
      Phaser.Input.Keyboard.KeyCodes.W,
    ]);
    this.input.keyboard?.on('keydown-SPACE', () => this.tryJump());
    this.input.keyboard?.on('keydown-UP', () => this.tryJump());
    this.input.keyboard?.on('keydown-W', () => this.tryJump());

    // Tap/click anywhere on the game canvas also jumps.
    this.input.on('pointerdown', () => this.tryJump());

    // Cross-module jump request (touch button) — defensive off() first so
    // a scene restart never stacks a second listener on the global bus.
    gameEvents.off('request-jump', this.handleJumpRequest);
    gameEvents.onTyped('request-jump', this.handleJumpRequest);

    document.removeEventListener('visibilitychange', this.handleVisibilityChange);
    document.addEventListener('visibilitychange', this.handleVisibilityChange);

    this.scale.off('resize', this.handleResize, this);
    this.scale.on('resize', this.handleResize, this);

    // Brief standing pose so the player sees their character before the
    // world starts moving.
    this.time.delayedCall(GAME_CONFIG.STANDING_INTRO_MS, () => {
      if (this.isGameOver) return;
      this.isRunStarted = true;
      this.setPlayerState('running');
    });
  }

  private buildSceneObjects(): void {
    this.bgYellow = this.add.rectangle(0, 0, 1, 1, FLAG_COLORS.yellow).setOrigin(0, 0);
    this.bgBlue = this.add.rectangle(0, 0, 1, 1, FLAG_COLORS.blue).setOrigin(0, 0);
    this.bgRed = this.add.rectangle(0, 0, 1, 1, FLAG_COLORS.red).setOrigin(0, 0);
    this.groundTile = this.add.tileSprite(0, 0, 1, GAME_CONFIG.GROUND_HEIGHT, GROUND_TILE_KEY).setOrigin(0, 0);
    this.buildPlayer();
  }

  /** Re-derives every position/size from the current viewport. Called once
   * from create() and again whenever Phaser's ScaleManager reports a
   * resize (orientation change, browser window resize, …) so the game
   * always fills the available screen with no letterboxing on phones. */
  private layout(width: number, height: number): void {
    this.viewWidth = width;

    const groundHeight = GAME_CONFIG.GROUND_HEIGHT;
    this.groundY = height - groundHeight;
    this.playerX = width * GAME_CONFIG.PLAYER_X_RATIO;

    const yellowH = height * 0.5;
    const blueH = height * 0.25;
    const redH = height * 0.25;
    this.bgYellow.setPosition(0, 0).setSize(width, yellowH);
    this.bgBlue.setPosition(0, yellowH).setSize(width, blueH);
    this.bgRed.setPosition(0, yellowH + blueH).setSize(width, redH);

    this.groundTile.setPosition(0, this.groundY).setSize(width, groundHeight);

    if (this.playerState !== 'jumping') {
      this.playerFeetY = this.groundY;
    }
    this.playerContainer.setPosition(this.playerX, this.playerFeetY);
  }

  private buildPlayer(): void {
    this.playerContainer = this.add.container(0, 0);

    this.bodyImage = this.add
      .image(0, 0, bodyTextureKey(this.character.id, 'standing'))
      .setOrigin(0.5, 1);

    const faceSize = 78;
    const overlapIntoNeck = 14;
    this.faceImage = this.add
      .image(0, -(BODY_TEXTURE_SIZE.height - overlapIntoNeck), faceTextureKey(this.character.id))
      .setOrigin(0.5, 1)
      .setDisplaySize(faceSize, faceSize);

    this.playerContainer.add([this.bodyImage, this.faceImage]);
  }

  private setPlayerState(state: PlayerState): void {
    this.playerState = state;
    if (state === 'running') return; // handled per-frame by run animation toggle
    const pose: BodyPose = state;
    this.bodyImage.setTexture(bodyTextureKey(this.character.id, pose));
  }

  private tryJump(): void {
    if (this.isGameOver || !this.isRunStarted) return;
    if (this.playerState === 'jumping') return; // no double jump
    this.playerVelocityY = GAME_CONFIG.JUMP_VELOCITY;
    this.setPlayerState('jumping');
  }

  private spawnObstacle(distanceM: number): void {
    const def = pickObstacle(distanceM);
    const image = this.add
      .image(this.viewWidth + def.displayWidth, this.groundY, def.textureKey)
      .setOrigin(0.5, 1)
      .setDisplaySize(def.displayWidth, def.displayHeight);
    image.setData('def', def);
    this.obstacles.push(image);
  }

  private getPlayerHitbox(): Rect {
    const { PLAYER_HITBOX_WIDTH, PLAYER_HITBOX_HEIGHT } = GAME_CONFIG;
    return {
      x: this.playerX - PLAYER_HITBOX_WIDTH / 2,
      y: this.playerFeetY - PLAYER_HITBOX_HEIGHT,
      width: PLAYER_HITBOX_WIDTH,
      height: PLAYER_HITBOX_HEIGHT,
    };
  }

  private triggerGameOver(): void {
    if (this.isGameOver) return;
    this.isGameOver = true;
    this.setPlayerState('hit');
    this.bodyImage.setTint(0xff9a8f);
    this.tweens.add({
      targets: this.playerContainer,
      angle: 14,
      duration: 220,
      ease: 'Sine.easeOut',
    });

    const result = recordRunResult(this.distanceM);
    gameEvents.emitTyped('game-over', result);
  }

  update(_time: number, deltaMs: number): void {
    if (this.isGameOver || !this.isRunStarted) return;

    const dt = Math.min(deltaMs, GAME_CONFIG.MAX_DELTA_MS) / 1000;

    this.scrollSpeed = getScrollSpeed(this.distanceM);
    this.distancePx += this.scrollSpeed * dt;
    gameEvents.emitTyped('distance-update', { distanceM: this.distanceM });

    this.groundTile.tilePositionX += this.scrollSpeed * dt;

    this.updatePlayerPhysics(dt);
    this.updateRunAnimation(deltaMs);
    this.updateObstacles(dt);
  }

  private updatePlayerPhysics(dt: number): void {
    if (this.playerState !== 'jumping') return;
    this.playerVelocityY += GAME_CONFIG.GRAVITY_Y * dt;
    this.playerFeetY += this.playerVelocityY * dt;
    if (this.playerFeetY >= this.groundY) {
      this.playerFeetY = this.groundY;
      this.playerVelocityY = 0;
      this.setPlayerState('running');
    }
    this.playerContainer.setY(this.playerFeetY);
  }

  private updateRunAnimation(deltaMs: number): void {
    if (this.playerState !== 'running') return;
    const frameDuration = GAME_CONFIG.RUN_FRAME_DURATION_MS * (GAME_CONFIG.BASE_SCROLL_SPEED / this.scrollSpeed);
    this.runFrameTimerMs += deltaMs;
    if (this.runFrameTimerMs < frameDuration) return;
    this.runFrameTimerMs = 0;
    this.runFrameToggle = !this.runFrameToggle;
    this.bodyImage.setTexture(bodyTextureKey(this.character.id, this.runFrameToggle ? 'run1' : 'run2'));
  }

  private updateObstacles(dt: number): void {
    this.spawnTimerSeconds -= dt;
    if (this.spawnTimerSeconds <= 0) {
      this.spawnObstacle(this.distanceM);
      this.spawnTimerSeconds = nextSpawnDelaySeconds(this.distanceM);
    }

    const playerHitbox = this.getPlayerHitbox();

    for (let i = this.obstacles.length - 1; i >= 0; i--) {
      const obstacle = this.obstacles[i];
      obstacle.x -= this.scrollSpeed * dt;

      const def = obstacle.getData('def') as ObstacleDefinition;
      if (obstacle.x < -def.displayWidth) {
        obstacle.destroy();
        this.obstacles.splice(i, 1);
        continue;
      }

      const hitbox = getObstacleHitbox(def, obstacle.x, this.groundY);
      if (rectsOverlap(playerHitbox, hitbox)) {
        this.triggerGameOver();
        return;
      }
    }
  }
}
