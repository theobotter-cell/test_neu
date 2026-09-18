import Phaser from 'phaser';
import { CHARACTERS } from './characters';
import type { BodyPalette, ObstacleType, PlayerState } from './types';

/**
 * All non-face visuals (character bodies, obstacles, the ground strip) are
 * drawn procedurally with Phaser's Graphics API and baked into textures
 * once at boot time via `generateTexture`. That keeps the whole game free
 * of large raster assets — important for the "no big background images /
 * runs well on old phones" performance requirement — while still giving a
 * consistent, bold cartoon look (flat fills + dark outlines everywhere).
 *
 * Only the four face PNGs in src/assets/faces/ are real bitmap assets; see
 * that folder's README for how they attach on top of the body drawn here.
 */

const BODY_W = 104;
const BODY_H = 132;
export const BODY_TEXTURE_SIZE = { width: BODY_W, height: BODY_H };

/** Y offset (relative to the body sprite's top) where the neck ends and a
 * face image should have its bottom edge, for every pose. Poses that bob
 * the whole body (run/jump) shift this slightly for a lively silhouette. */
const NECK_TOP_Y = 0;

export type BodyPose = Extract<PlayerState, 'standing' | 'jumping' | 'hit'> | 'run1' | 'run2';

export function bodyTextureKey(characterId: string, pose: BodyPose): string {
  return `body_${characterId}_${pose}`;
}

function roundedRect(
  g: Phaser.GameObjects.Graphics,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
  fill: number,
  outline: number,
  outlineWidth = 3
) {
  g.fillStyle(fill, 1);
  g.fillRoundedRect(x, y, w, h, r);
  g.lineStyle(outlineWidth, outline, 1);
  g.strokeRoundedRect(x, y, w, h, r);
}

const OUTLINE = 0x22160f;

interface Limb {
  x: number;
  y: number;
  w: number;
  h: number;
  r?: number;
}

function drawLimbs(g: Phaser.GameObjects.Graphics, arms: [Limb, Limb], legs: [Limb, Limb], palette: BodyPalette) {
  const skinColor = Phaser.Display.Color.HexStringToColor(palette.skin).color;
  const secondaryColor = Phaser.Display.Color.HexStringToColor(palette.secondary).color;
  const accentColor = Phaser.Display.Color.HexStringToColor(palette.accent).color;

  // Legs (behind torso, drawn first) with shoes at the tip.
  for (const leg of legs) {
    roundedRect(g, leg.x, leg.y, leg.w, leg.h, leg.r ?? 6, secondaryColor, OUTLINE);
    const shoeH = Math.min(12, leg.h * 0.3);
    roundedRect(g, leg.x - 2, leg.y + leg.h - shoeH, leg.w + 4, shoeH, 5, accentColor, OUTLINE);
  }
  // Arms
  for (const arm of arms) {
    roundedRect(g, arm.x, arm.y, arm.w, arm.h, arm.r ?? 6, skinColor, OUTLINE);
  }
}

function drawTorso(g: Phaser.GameObjects.Graphics, palette: BodyPalette) {
  const primary = Phaser.Display.Color.HexStringToColor(palette.primary).color;
  const accent = Phaser.Display.Color.HexStringToColor(palette.accent).color;
  const skin = Phaser.Display.Color.HexStringToColor(palette.skin).color;

  // Neck stub the face PNG will sit on top of.
  roundedRect(g, BODY_W / 2 - 12, NECK_TOP_Y, 24, 22, 6, skin, OUTLINE);
  // Torso
  roundedRect(g, 22, 16, 60, 56, 12, primary, OUTLINE);
  // Waist belt accent stripe
  g.fillStyle(accent, 1);
  g.fillRect(22, 56, 60, 10);
  g.lineStyle(3, OUTLINE, 1);
  g.strokeRect(22, 56, 60, 10);
}

function drawBodyPose(g: Phaser.GameObjects.Graphics, palette: BodyPalette, pose: BodyPose) {
  g.clear();

  let arms: [Limb, Limb];
  let legs: [Limb, Limb];

  switch (pose) {
    case 'standing':
      arms = [
        { x: 10, y: 26, w: 12, h: 42 },
        { x: 82, y: 26, w: 12, h: 42 },
      ];
      legs = [
        { x: 34, y: 72, w: 16, h: 46 },
        { x: 54, y: 72, w: 16, h: 46 },
      ];
      break;
    case 'run1':
      arms = [
        { x: 4, y: 18, w: 12, h: 40 },
        { x: 88, y: 32, w: 12, h: 38 },
      ];
      legs = [
        { x: 28, y: 68, w: 16, h: 34 },
        { x: 58, y: 76, w: 14, h: 52 },
      ];
      break;
    case 'run2':
      arms = [
        { x: 88, y: 18, w: 12, h: 40 },
        { x: 4, y: 32, w: 12, h: 38 },
      ];
      legs = [
        { x: 60, y: 68, w: 16, h: 34 },
        { x: 30, y: 76, w: 14, h: 52 },
      ];
      break;
    case 'jumping':
      arms = [
        { x: 2, y: 2, w: 13, h: 38 },
        { x: 89, y: 2, w: 13, h: 38 },
      ];
      legs = [
        { x: 30, y: 78, w: 18, h: 30 },
        { x: 56, y: 78, w: 18, h: 30 },
      ];
      break;
    case 'hit':
      arms = [
        { x: -2, y: 22, w: 28, h: 15, r: 7 },
        { x: 78, y: 22, w: 28, h: 15, r: 7 },
      ];
      legs = [
        { x: 20, y: 84, w: 26, h: 22, r: 8 },
        { x: 58, y: 84, w: 26, h: 22, r: 8 },
      ];
      break;
  }

  drawLimbs(g, arms, legs, palette);
  drawTorso(g, palette);
}

export function generateCharacterTextures(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const poses: BodyPose[] = ['standing', 'run1', 'run2', 'jumping', 'hit'];
  for (const character of CHARACTERS) {
    for (const pose of poses) {
      const key = bodyTextureKey(character.id, pose);
      if (scene.textures.exists(key)) continue;
      drawBodyPose(g, character.palette, pose);
      g.generateTexture(key, BODY_W, BODY_H);
    }
  }
  g.destroy();
}

// ---------------------------------------------------------------------
// Obstacles
// ---------------------------------------------------------------------

const OBSTACLE_CANVAS = { width: 96, height: 110 };

function drawRock(g: Phaser.GameObjects.Graphics) {
  const base = 0x8a8a8a;
  const dark = 0x686868;
  const light = 0xb0b0ac;
  g.fillStyle(base, 1);
  const points = [
    [12, 90],
    [8, 60],
    [26, 30],
    [46, 14],
    [70, 22],
    [86, 52],
    [82, 88],
    [50, 96],
  ];
  g.beginPath();
  g.moveTo(points[0][0], points[0][1]);
  for (const [x, y] of points.slice(1)) g.lineTo(x, y);
  g.closePath();
  g.fillPath();
  g.lineStyle(4, OUTLINE, 1);
  g.strokePath();
  // facets
  g.fillStyle(light, 1);
  g.beginPath();
  g.moveTo(26, 30);
  g.lineTo(46, 14);
  g.lineTo(50, 40);
  g.lineTo(30, 46);
  g.closePath();
  g.fillPath();
  g.fillStyle(dark, 1);
  g.beginPath();
  g.moveTo(50, 40);
  g.lineTo(70, 22);
  g.lineTo(86, 52);
  g.lineTo(60, 58);
  g.closePath();
  g.fillPath();
}

function drawEye(g: Phaser.GameObjects.Graphics, x: number, y: number, r: number, angry = false) {
  g.fillStyle(0xffffff, 1);
  g.fillCircle(x, y, r);
  g.lineStyle(3, OUTLINE, 1);
  g.strokeCircle(x, y, r);
  g.fillStyle(0x1a1410, 1);
  g.fillCircle(x, y + r * 0.1, r * 0.5);
  if (angry) {
    g.lineStyle(4, OUTLINE, 1);
    g.beginPath();
    g.moveTo(x - r * 1.3, y - r * 1.4);
    g.lineTo(x + r * 0.6, y - r * 0.5);
    g.strokePath();
  }
}

function drawMonsterA(g: Phaser.GameObjects.Graphics) {
  const body = 0x5fb06a;
  g.fillStyle(body, 1);
  g.fillEllipse(48, 62, 62, 66);
  g.lineStyle(4, OUTLINE, 1);
  g.strokeEllipse(48, 62, 62, 66);
  // horns
  g.fillStyle(body, 1);
  for (const side of [-1, 1]) {
    g.beginPath();
    g.moveTo(48 + side * 14, 32);
    g.lineTo(48 + side * 24, 4);
    g.lineTo(48 + side * 30, 34);
    g.closePath();
    g.fillPath();
    g.lineStyle(3, OUTLINE, 1);
    g.strokePath();
  }
  drawEye(g, 34, 54, 11, true);
  drawEye(g, 62, 54, 11, true);
  // jagged mouth
  g.fillStyle(0x2c1a14, 1);
  g.beginPath();
  g.moveTo(24, 80);
  g.lineTo(72, 80);
  g.lineTo(66, 96);
  g.lineTo(58, 84);
  g.lineTo(50, 96);
  g.lineTo(42, 84);
  g.lineTo(34, 96);
  g.closePath();
  g.fillPath();
  g.lineStyle(3, OUTLINE, 1);
  g.strokePath();
  // stub legs
  g.fillStyle(body, 1);
  roundedRect(g, 30, 94, 12, 14, 4, body, OUTLINE, 3);
  roundedRect(g, 54, 94, 12, 14, 4, body, OUTLINE, 3);
}

function drawMonsterB(g: Phaser.GameObjects.Graphics) {
  const body = 0x6a5acd;
  roundedRect(g, 20, 30, 56, 68, 18, body, OUTLINE, 4);
  // back spikes
  g.fillStyle(body, 1);
  for (let i = 0; i < 4; i++) {
    const x = 32 + i * 12;
    g.beginPath();
    g.moveTo(x - 7, 32);
    g.lineTo(x, 8);
    g.lineTo(x + 7, 32);
    g.closePath();
    g.fillPath();
    g.lineStyle(3, OUTLINE, 1);
    g.strokePath();
  }
  drawEye(g, 48, 56, 15, true);
  // clawed arms
  for (const side of [-1, 1]) {
    roundedRect(g, side > 0 ? 74 : 6, 58, 16, 14, 6, body, OUTLINE, 3);
    g.fillStyle(0xe7e0d8, 1);
    for (let c = 0; c < 3; c++) {
      const cx = (side > 0 ? 78 : 10) + c * 5;
      g.beginPath();
      g.moveTo(cx, 70);
      g.lineTo(cx + 3, 80);
      g.lineTo(cx + 6, 70);
      g.closePath();
      g.fillPath();
    }
  }
  // mouth
  g.fillStyle(0x2c1a14, 1);
  g.fillRoundedRect(34, 78, 28, 12, 4);
  g.lineStyle(3, OUTLINE, 1);
  g.strokeRoundedRect(34, 78, 28, 12, 4);
}

function drawMonsterC(g: Phaser.GameObjects.Graphics) {
  const body = 0xd94f70;
  const cx = 48;
  const cy = 58;
  const r = 34;
  // spikes radiating out
  g.fillStyle(body, 1);
  for (let i = 0; i < 12; i++) {
    const angle = (i / 12) * Math.PI * 2;
    const bx1 = cx + Math.cos(angle - 0.14) * r * 0.85;
    const by1 = cy + Math.sin(angle - 0.14) * r * 0.85;
    const bx2 = cx + Math.cos(angle + 0.14) * r * 0.85;
    const by2 = cy + Math.sin(angle + 0.14) * r * 0.85;
    const tx = cx + Math.cos(angle) * r * 1.35;
    const ty = cy + Math.sin(angle) * r * 1.35;
    g.beginPath();
    g.moveTo(bx1, by1);
    g.lineTo(tx, ty);
    g.lineTo(bx2, by2);
    g.closePath();
    g.fillPath();
    g.lineStyle(2.5, OUTLINE, 1);
    g.strokePath();
  }
  g.fillStyle(body, 1);
  g.fillCircle(cx, cy, r);
  g.lineStyle(4, OUTLINE, 1);
  g.strokeCircle(cx, cy, r);
  drawEye(g, cx - 12, cy - 4, 10, true);
  drawEye(g, cx + 12, cy - 4, 10, true);
  g.lineStyle(4, OUTLINE, 1);
  g.beginPath();
  g.arc(cx, cy + 12, 12, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160));
  g.strokePath();
}

function drawDevilsBreath(g: Phaser.GameObjects.Graphics) {
  // pot
  const potColor = 0x8a5a3c;
  g.fillStyle(potColor, 1);
  g.beginPath();
  g.moveTo(28, 92);
  g.lineTo(68, 92);
  g.lineTo(62, 108);
  g.lineTo(34, 108);
  g.closePath();
  g.fillPath();
  g.lineStyle(3, OUTLINE, 1);
  g.strokePath();
  // stem
  g.lineStyle(6, 0x3f6b2f, 1);
  g.beginPath();
  g.moveTo(48, 92);
  g.lineTo(48, 46);
  g.strokePath();
  g.lineStyle(4, 0x4d7d3a, 1);
  g.beginPath();
  g.moveTo(48, 78);
  g.lineTo(30, 66);
  g.moveTo(48, 60);
  g.lineTo(66, 50);
  g.strokePath();

  const trumpet = (x: number, y: number, scale: number, rotation: number) => {
    g.save();
    g.translateCanvas(x, y);
    g.rotateCanvas(rotation);
    g.scaleCanvas(scale, scale);
    // outer white bell (flared cone made of a triangle + arc-ish notches)
    g.fillStyle(0xfaf6e8, 1);
    g.beginPath();
    g.moveTo(0, 0);
    g.lineTo(-16, -30);
    g.lineTo(-6, -34);
    g.lineTo(0, -26);
    g.lineTo(6, -34);
    g.lineTo(16, -30);
    g.closePath();
    g.fillPath();
    g.lineStyle(2.5, OUTLINE, 1);
    g.strokePath();
    // inner yellow throat
    g.fillStyle(0xf4d35e, 1);
    g.beginPath();
    g.moveTo(0, -4);
    g.lineTo(-7, -22);
    g.lineTo(0, -18);
    g.lineTo(7, -22);
    g.closePath();
    g.fillPath();
    g.restore();
  };
  trumpet(30, 46, 0.95, Phaser.Math.DegToRad(-25));
  trumpet(48, 34, 1.05, 0);
  trumpet(66, 48, 0.9, Phaser.Math.DegToRad(28));

  // faint poisonous mist above the flowers — deliberately excluded from
  // the obstacle's hitbox (see src/game/obstacles.ts).
  g.fillStyle(0x9fd6a0, 0.28);
  g.fillCircle(40, 14, 14);
  g.fillCircle(56, 10, 16);
  g.fillCircle(48, 20, 12);
  g.fillStyle(0x9fd6a0, 0.18);
  g.fillCircle(48, 4, 16);
}

function drawVisaDocument(g: Phaser.GameObjects.Graphics) {
  const cardColor = 0xf3ecd9;
  roundedRect(g, 8, 6, 80, 98, 8, cardColor, OUTLINE, 4);
  // generic photo placeholder box (top-left), plain silhouette, no emblem
  g.fillStyle(0xd8cdb0, 1);
  g.fillRoundedRect(16, 16, 24, 30, 3);
  g.lineStyle(2, OUTLINE, 1);
  g.strokeRoundedRect(16, 16, 24, 30, 3);
  g.fillStyle(0xb9ac8a, 1);
  g.fillCircle(28, 26, 6);
  g.fillTriangle(19, 44, 37, 44, 28, 32);
  // generic text lines (no real text/logos)
  g.fillStyle(0xb9ac8a, 1);
  g.fillRect(46, 18, 34, 5);
  g.fillRect(46, 28, 30, 5);
  g.fillRect(46, 38, 32, 5);
  g.fillRect(16, 54, 64, 4);
  g.fillRect(16, 62, 50, 4);
  g.fillRect(16, 70, 56, 4);
  g.fillRect(16, 78, 40, 4);
  // large red prohibition symbol
  const cx = 48;
  const cy = 58;
  const r = 34;
  g.fillStyle(0xd6362c, 0.9);
  g.fillCircle(cx, cy, r);
  g.fillStyle(cardColor, 1);
  g.fillCircle(cx, cy, r - 8);
  g.lineStyle(10, 0xd6362c, 0.95);
  g.beginPath();
  const a = Phaser.Math.DegToRad(40);
  g.moveTo(cx - Math.cos(a) * (r - 4), cy - Math.sin(a) * (r - 4));
  g.lineTo(cx + Math.cos(a) * (r - 4), cy + Math.sin(a) * (r - 4));
  g.strokePath();
}

const OBSTACLE_DRAWERS: Record<ObstacleType, (g: Phaser.GameObjects.Graphics) => void> = {
  rock: drawRock,
  monster_a: drawMonsterA,
  monster_b: drawMonsterB,
  monster_c: drawMonsterC,
  devils_breath: drawDevilsBreath,
  visa_document: drawVisaDocument,
};

export function generateObstacleTextures(scene: Phaser.Scene): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  for (const [type, draw] of Object.entries(OBSTACLE_DRAWERS) as [ObstacleType, typeof drawRock][]) {
    const key = `obstacle_${type}`;
    if (scene.textures.exists(key)) continue;
    g.clear();
    draw(g);
    g.generateTexture(key, OBSTACLE_CANVAS.width, OBSTACLE_CANVAS.height);
  }
  g.destroy();
}

// ---------------------------------------------------------------------
// Ground (grass + dirt), drawn once as a small tileable strip.
// ---------------------------------------------------------------------

export const GROUND_TILE_KEY = 'ground_tile';
const GROUND_TILE_WIDTH = 64;

export function generateGroundTexture(scene: Phaser.Scene, groundHeight: number): void {
  if (scene.textures.exists(GROUND_TILE_KEY)) return;
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const grassH = Math.round(groundHeight * 0.28);
  g.fillStyle(0x5aa844, 1);
  g.fillRect(0, 0, GROUND_TILE_WIDTH, grassH);
  g.fillStyle(0x4a8f37, 1);
  for (let x = 0; x < GROUND_TILE_WIDTH; x += 8) {
    g.fillRect(x + 2, grassH - 5, 3, 5);
  }
  g.fillStyle(0x8a5a34, 1);
  g.fillRect(0, grassH, GROUND_TILE_WIDTH, groundHeight - grassH);
  g.fillStyle(0x764a2a, 1);
  for (let x = 0; x < GROUND_TILE_WIDTH; x += 16) {
    g.fillEllipse(x + 8, grassH + 14, 10, 5);
  }
  g.lineStyle(3, 0x2e6b22, 1);
  g.lineBetween(0, grassH, GROUND_TILE_WIDTH, grassH);
  g.generateTexture(GROUND_TILE_KEY, GROUND_TILE_WIDTH, groundHeight);
  g.destroy();
}

export function generateAllTextures(scene: Phaser.Scene, groundHeight: number): void {
  generateCharacterTextures(scene);
  generateObstacleTextures(scene);
  generateGroundTexture(scene, groundHeight);
}
