/**
 * Central tuning values for "Road to Colombia".
 *
 * Everything gameplay-related that a designer might want to tweak lives
 * here, in one place, with the reasoning documented inline. Nothing here
 * needs code changes elsewhere to take effect.
 */
export const GAME_CONFIG = {
  /**
   * Reference/initial resolution, 16:9. Only used as Phaser's starting
   * canvas size and as the baseline for scroll-speed tuning — the actual
   * play area is resized live to fill whatever space is available (see
   * Phaser.Scale.RESIZE in main.ts and GameScene's resize handling), so
   * desktop gets a centered ~16:9 box (via CSS, see style.css) while
   * phones — portrait or landscape — use the full screen with no
   * letterboxing.
   */
  BASE_WIDTH: 960,
  BASE_HEIGHT: 540,

  /** Height of the ground strip (grass + dirt) in pixels, at base resolution. */
  GROUND_HEIGHT: 108,

  /** Player stays fixed at this fraction of the screen width (left third). */
  PLAYER_X_RATIO: 0.22,

  /** Downward acceleration in px/s². Tuned together with JUMP_VELOCITY
   * for a snappy but readable ~0.75s jump arc. */
  GRAVITY_Y: 2200,

  /** Initial upward velocity in px/s when jumping (negative = up). */
  JUMP_VELOCITY: -850,

  /** How many horizontal pixels of world-scroll equal one "meter" on the
   * HUD/score. Purely a display scale, not a physical simulation. */
  PIXELS_PER_METER: 10,

  /** World scroll speed in px/s at the very start of a run. */
  BASE_SCROLL_SPEED: 300,

  /** World scroll speed in px/s once maximum difficulty is reached. */
  MAX_SCROLL_SPEED: 620,

  /** Distance (in meters) over which difficulty ramps from 0 to 1 (then
   * stays at max). Speed, spawn frequency and obstacle variety all scale
   * off this same 0..1 "difficulty" value. */
  DIFFICULTY_DISTANCE_SCALE_M: 1000,

  /**
   * Randomized time gap between obstacle spawns, in seconds. Interpolated
   * by the current difficulty (see DIFFICULTY_DISTANCE_SCALE_M): it starts
   * generous and narrows as the run goes on, which is what makes the game
   * "etwas häufiger" over time without ever producing back-to-back
   * unavoidable obstacles (the minimum floor below is deliberately kept
   * above JUMP_VELOCITY/GRAVITY_Y's ~0.75s airtime plus reaction time).
   */
  SPAWN_GAP_SECONDS: {
    minAtStart: 1.3,
    minAtMaxDifficulty: 0.95,
    maxAtStart: 2.2,
    maxAtMaxDifficulty: 1.5,
  },

  /** Hard safety floor: no obstacle may ever be scheduled sooner than this
   * many seconds after the previous one, regardless of difficulty. */
  ABSOLUTE_MIN_SPAWN_GAP_SECONDS: 0.9,

  /** Run-cycle animation frame duration in ms at the base scroll speed;
   * scaled down slightly as the world speeds up so the legs "keep up". */
  RUN_FRAME_DURATION_MS: 120,

  /** Caps how large a single simulation step can be (ms). Prevents a
   * physics/spawn-timer explosion after the tab was backgrounded and the
   * browser delivers one huge delta on resume. */
  MAX_DELTA_MS: 100,

  /** Caps devicePixelRatio-driven canvas resolution so very high-DPI phones
   * don't render more pixels than the game actually needs. */
  MAX_DEVICE_PIXEL_RATIO: 2,

  /** Player collision box (px), constant across poses for predictable,
   * fair collisions — anchored bottom-center on the character's feet. */
  PLAYER_HITBOX_WIDTH: 44,
  PLAYER_HITBOX_HEIGHT: 108,

  /** How long (ms) the character visibly stands still before the run
   * auto-starts, giving the player a moment to see their pick. */
  STANDING_INTRO_MS: 500,
} as const;

export const STORAGE_KEYS = {
  bestDistanceM: 'roadToColombia.bestDistanceM',
  lastCharacterId: 'roadToColombia.lastCharacterId',
} as const;
