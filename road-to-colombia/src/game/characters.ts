import type { CharacterDefinition } from './types';

/**
 * The four selectable characters. Only the face image and the body color
 * palette differ between them — animation logic and hitboxes are shared
 * (see src/game/textures.ts and src/scenes/GameScene.ts).
 *
 * To add a new character:
 *   1. Drop a new face PNG into src/assets/faces/ (see the README there
 *      for size/format rules) — e.g. "face_5.png".
 *   2. Add an entry below with a unique `id`, a `name`, the `facePath`
 *      filename, and a `palette`. Nothing else needs to change; the
 *      character-select screen and texture generator read this array.
 */
export const CHARACTERS: CharacterDefinition[] = [
  {
    id: 'sol',
    name: 'Sol',
    facePath: 'face_1.png',
    palette: {
      primary: '#e8632c',
      secondary: '#2b4a7a',
      accent: '#f4c430',
      skin: '#c98455',
    },
  },
  {
    id: 'mango',
    name: 'Mango',
    facePath: 'face_2.png',
    palette: {
      primary: '#2f9e5b',
      secondary: '#22364f',
      accent: '#ffd166',
      skin: '#f2c9a0',
    },
  },
  {
    id: 'nube',
    name: 'Nube',
    facePath: 'face_3.png',
    palette: {
      primary: '#7b3fb0',
      secondary: '#1f2a44',
      accent: '#f4c430',
      skin: '#8a5a3c',
    },
  },
  {
    id: 'cafe',
    name: 'Café',
    facePath: 'face_4.png',
    palette: {
      primary: '#2f5fa8',
      secondary: '#3a2a1e',
      accent: '#e8632c',
      skin: '#d9a468',
    },
  },
];

export function getCharacterById(id: string): CharacterDefinition {
  const found = CHARACTERS.find((c) => c.id === id);
  return found ?? CHARACTERS[0];
}
