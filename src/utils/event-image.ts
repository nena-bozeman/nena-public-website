import type { ImageMetadata } from 'astro';

const eventPhotos = import.meta.glob('/src/assets/events/**/*.{jpg,jpeg,png,webp,avif}', {
  import: 'default',
  eager: true,
}) as unknown as Record<string, ImageMetadata>;

/**
 * Resolves a processed photo for an event page. Add files to `src/assets/events/`
 * and set `image` in frontmatter to a filename in that tree (e.g. `2026-10-22-nena-fall-meeting.jpg`).
 */
export function getEventImage(imageFilename: string | undefined): ImageMetadata | undefined {
  if (!imageFilename) return undefined;
  const byName = Object.keys(eventPhotos).find((key) => key.endsWith('/' + imageFilename));
  if (!byName) {
    throw new Error(`Event image "${imageFilename}" was not found in src/assets/events/.`);
  }
  return eventPhotos[byName];
}
