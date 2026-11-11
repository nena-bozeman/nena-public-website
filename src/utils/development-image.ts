import type { ImageMetadata } from 'astro';

const developmentPhotos = import.meta.glob('/src/assets/development/**/*.{jpg,jpeg,png,webp,avif}', {
  import: 'default',
  eager: true,
}) as unknown as Record<string, ImageMetadata>;

/**
 * Resolves a processed photo for a development project. Add files to
 * `src/assets/development/` and set `image` in frontmatter to a filename in
 * that tree (e.g. `bozeman-yards.jpg`).
 */
export function getDevelopmentImage(imageFilename: string | undefined): ImageMetadata | undefined {
  if (!imageFilename) return undefined;
  const byName = Object.keys(developmentPhotos).find((key) => key.endsWith('/' + imageFilename));
  if (!byName) {
    throw new Error(`Development image "${imageFilename}" was not found in src/assets/development/.`);
  }
  return developmentPhotos[byName];
}
