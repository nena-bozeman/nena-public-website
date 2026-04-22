import type { ImageMetadata } from 'astro';

const businessCovers = import.meta.glob('/src/assets/businesses/**/*.{jpg,jpeg,png,webp,avif}', {
  import: 'default',
  eager: true,
}) as unknown as Record<string, ImageMetadata>;

/**
 * Resolves a processed cover image for a business. Add files to `src/assets/businesses/`
 * named like `<slug>.webp` or set `image` in frontmatter to a filename in that tree (e.g. `foo/bar.webp`).
 */
export function getBusinessCoverImage(slug: string, imageFilename: string | undefined): ImageMetadata | undefined {
  const keys = Object.keys(businessCovers);
  if (imageFilename) {
    const byName = keys.find(
      (k) => k.endsWith('/' + imageFilename) || k.endsWith(imageFilename) || k.includes('/' + imageFilename),
    );
    if (byName) return businessCovers[byName];
  }
  for (const ext of ['webp', 'jpg', 'jpeg', 'png', 'avif'] as const) {
    const file = `${slug}.${ext}`;
    const bySlug = keys.find((k) => (k.split('/').pop() ?? '') === file);
    if (bySlug) return businessCovers[bySlug];
  }
  return undefined;
}
