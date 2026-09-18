/** Shared type definitions used across the game modules. */

/** Visual color palette used to procedurally draw a character's body. */
export interface BodyPalette {
  /** Main shirt/torso color. */
  primary: string;
  /** Pants/legs color. */
  secondary: string;
  /** Shoes + small accent details color. */
  accent: string;
  /** Skin tone for hands/neck (should roughly match the character's face). */
  skin: string;
}

export interface CharacterDefinition {
  /** Stable identifier, also used as a texture-key prefix. */
  id: string;
  /** Display name shown in the character-select screen. */
  name: string;
  /** Filename inside src/assets/faces/ (see the README there). */
  facePath: string;
  /** Body color palette, see BodyPalette. */
  palette: BodyPalette;
}

/** The finite set of visual/behavioural states the player character can be in. */
export type PlayerState = 'standing' | 'running' | 'jumping' | 'hit';

/** The four required obstacle categories, each with its own silhouette. */
export type ObstacleType =
  | 'monster_a'
  | 'monster_b'
  | 'monster_c'
  | 'rock'
  | 'devils_breath'
  | 'visa_document';

export interface ObstacleDefinition {
  type: ObstacleType;
  /** Texture key registered by src/game/textures.ts. */
  textureKey: string;
  /** Rendered display size in pixels (at base game resolution). */
  displayWidth: number;
  displayHeight: number;
  /**
   * Collision box, expressed as ratios (0..1) of displayWidth/displayHeight
   * rather than absolute pixels so it stays correct regardless of texture
   * scaling. Intentionally smaller than the sprite so grazing a wing tip or
   * the devil's breath mist cloud doesn't feel unfair ("faire
   * Kollisionsfläche").
   */
  hitboxWidthRatio: number;
  hitboxHeightRatio: number;
  /** Offset of the hitbox from the sprite's top-left, as a ratio of
   * displayWidth/displayHeight. */
  hitboxOffsetXRatio: number;
  hitboxOffsetYRatio: number;
  /** Relative spawn probability weight (higher = more common). */
  weight: number;
  /** Meters of distance the player must reach before this can spawn. */
  unlockDistanceM: number;
}

export interface RunResult {
  distanceM: number;
  bestDistanceM: number;
  isNewRecord: boolean;
}
