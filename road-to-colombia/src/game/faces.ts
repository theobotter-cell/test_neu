/**
 * Resolves face PNG filenames (as referenced by CharacterDefinition.facePath
 * in characters.ts) to the URL Vite emits for them in the production build.
 *
 * Uses `import.meta.glob` so that dropping a brand-new face_N.png into
 * src/assets/faces/ (see the README there) and referencing it from
 * characters.ts is enough — no import statement needs to be added here.
 */
const faceModules = import.meta.glob<string>('../assets/faces/*.png', {
  eager: true,
  query: '?url',
  import: 'default',
});

const facesByFilename = new Map<string, string>();
for (const [path, url] of Object.entries(faceModules)) {
  const filename = path.split('/').pop();
  if (filename) facesByFilename.set(filename, url);
}

export function getFaceUrl(facePath: string): string {
  const url = facesByFilename.get(facePath);
  if (!url) {
    throw new Error(`Unknown face asset "${facePath}" — expected a file at src/assets/faces/${facePath}`);
  }
  return url;
}

export function faceTextureKey(characterId: string): string {
  return `face_${characterId}`;
}
