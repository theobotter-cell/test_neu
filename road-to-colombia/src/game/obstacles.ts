import { GAME_CONFIG } from './config';
import type { ObstacleDefinition, ObstacleType } from './types';

/**
 * All obstacle definitions. Exactly one obstacle spawns at a time (never a
 * cluster) which, combined with the time-based spawn gap in
 * `nextSpawnDelaySeconds`, guarantees every obstacle is reachable and
 * jumpable — there is no code path that can produce an impossible
 * combination.
 *
 * Hitboxes are expressed as ratios of the display size and are
 * intentionally smaller than the sprite (see hitbox*Ratio fields) so a
 * grazing wingtip, the devil's breath mist, or the passport's rounded
 * corner never triggers an unfair collision.
 */
export const OBSTACLES: ObstacleDefinition[] = [
  {
    type: 'rock',
    textureKey: 'obstacle_rock',
    displayWidth: 64,
    displayHeight: 52,
    hitboxWidthRatio: 0.78,
    hitboxHeightRatio: 0.77,
    hitboxOffsetXRatio: 0.11,
    hitboxOffsetYRatio: 0.23,
    weight: 3,
    unlockDistanceM: 0,
  },
  {
    type: 'monster_a',
    textureKey: 'obstacle_monster_a',
    displayWidth: 70,
    displayHeight: 78,
    hitboxWidthRatio: 0.66,
    hitboxHeightRatio: 0.77,
    hitboxOffsetXRatio: 0.17,
    hitboxOffsetYRatio: 0.21,
    weight: 3,
    unlockDistanceM: 0,
  },
  {
    type: 'monster_b',
    textureKey: 'obstacle_monster_b',
    displayWidth: 74,
    displayHeight: 84,
    hitboxWidthRatio: 0.65,
    hitboxHeightRatio: 0.76,
    hitboxOffsetXRatio: 0.18,
    hitboxOffsetYRatio: 0.21,
    weight: 2.5,
    unlockDistanceM: 120,
  },
  {
    type: 'devils_breath',
    textureKey: 'obstacle_devils_breath',
    displayWidth: 72,
    displayHeight: 96,
    // The hitbox covers the stem/flowers only, not the wispy mist cloud
    // above it — grazing the mist should never feel like a cheap death.
    hitboxWidthRatio: 0.56,
    hitboxHeightRatio: 0.69,
    hitboxOffsetXRatio: 0.22,
    hitboxOffsetYRatio: 0.31,
    weight: 2,
    unlockDistanceM: 260,
  },
  {
    type: 'visa_document',
    textureKey: 'obstacle_visa_document',
    displayWidth: 58,
    displayHeight: 78,
    hitboxWidthRatio: 0.79,
    hitboxHeightRatio: 0.79,
    hitboxOffsetXRatio: 0.1,
    hitboxOffsetYRatio: 0.1,
    weight: 2,
    unlockDistanceM: 380,
  },
  {
    type: 'monster_c',
    textureKey: 'obstacle_monster_c',
    displayWidth: 80,
    displayHeight: 90,
    hitboxWidthRatio: 0.65,
    hitboxHeightRatio: 0.76,
    hitboxOffsetXRatio: 0.18,
    hitboxOffsetYRatio: 0.2,
    weight: 2.5,
    unlockDistanceM: 520,
  },
];

export function getObstacleDefinition(type: ObstacleType): ObstacleDefinition {
  const found = OBSTACLES.find((o) => o.type === type);
  if (!found) throw new Error(`Unknown obstacle type: ${type}`);
  return found;
}

/** Difficulty as a 0..1 value, ramping linearly over DIFFICULTY_DISTANCE_SCALE_M. */
export function getDifficulty(distanceM: number): number {
  return Math.max(0, Math.min(1, distanceM / GAME_CONFIG.DIFFICULTY_DISTANCE_SCALE_M));
}

/** Current world scroll speed in px/s for the given distance travelled. */
export function getScrollSpeed(distanceM: number): number {
  const t = getDifficulty(distanceM);
  return GAME_CONFIG.BASE_SCROLL_SPEED + t * (GAME_CONFIG.MAX_SCROLL_SPEED - GAME_CONFIG.BASE_SCROLL_SPEED);
}

/** Picks a random delay (seconds) until the next obstacle should spawn. */
export function nextSpawnDelaySeconds(distanceM: number): number {
  const t = getDifficulty(distanceM);
  const { minAtStart, minAtMaxDifficulty, maxAtStart, maxAtMaxDifficulty } = GAME_CONFIG.SPAWN_GAP_SECONDS;
  const min = Math.max(
    GAME_CONFIG.ABSOLUTE_MIN_SPAWN_GAP_SECONDS,
    minAtStart + t * (minAtMaxDifficulty - minAtStart)
  );
  const max = Math.max(min, maxAtStart + t * (maxAtMaxDifficulty - maxAtStart));
  return min + Math.random() * (max - min);
}

/** Weighted-random pick among obstacles already unlocked at this distance. */
export function pickObstacle(distanceM: number): ObstacleDefinition {
  const available = OBSTACLES.filter((o) => o.unlockDistanceM <= distanceM);
  const pool = available.length > 0 ? available : [OBSTACLES[0]];
  const totalWeight = pool.reduce((sum, o) => sum + o.weight, 0);
  let roll = Math.random() * totalWeight;
  for (const obstacle of pool) {
    roll -= obstacle.weight;
    if (roll <= 0) return obstacle;
  }
  return pool[pool.length - 1];
}

/** Computes the world-space AABB hitbox for an obstacle placed with
 * origin (0.5, 1) — i.e. bottom-center — at (spriteX, spriteFeetY). */
export function getObstacleHitbox(
  def: ObstacleDefinition,
  spriteX: number,
  spriteFeetY: number
): { x: number; y: number; width: number; height: number } {
  const left = spriteX - def.displayWidth / 2;
  const top = spriteFeetY - def.displayHeight;
  return {
    x: left + def.hitboxOffsetXRatio * def.displayWidth,
    y: top + def.hitboxOffsetYRatio * def.displayHeight,
    width: def.hitboxWidthRatio * def.displayWidth,
    height: def.hitboxHeightRatio * def.displayHeight,
  };
}
