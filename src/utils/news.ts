import type { CollectionEntry } from 'astro:content';

export const NEWS_PER_PAGE = 10;

/** In production builds, excludes entries with `draft: true`. Dev servers include all posts. */
export function newsEntriesForSite(
  entries: CollectionEntry<'news'>[],
): CollectionEntry<'news'>[] {
  if (import.meta.env.PROD) {
    return entries.filter((e) => !e.data.draft);
  }
  return entries;
}

/** News posts that include at least one of the given tags (OR), newest first. */
export function newsPostsMatchingAnyTag(
  entries: CollectionEntry<'news'>[],
  tags: string[],
): CollectionEntry<'news'>[] {
  if (tags.length === 0) return [];
  const tagSet = new Set(tags);
  return sortNewsByDateDesc(
    entries.filter((e) => e.data.tags.some((t) => tagSet.has(t))),
  );
}

export function sortNewsByDateDesc(
  entries: CollectionEntry<'news'>[],
): CollectionEntry<'news'>[] {
  return [...entries].sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export function totalNewsPages(count: number): number {
  return Math.max(1, Math.ceil(count / NEWS_PER_PAGE));
}

/** Title-style label for a tag slug (e.g. `trails-pocket-parks` → "Trails Pocket Parks"). */
export function formatNewsTagLabel(tag: string): string {
  return tag
    .split('-')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1).toLowerCase() : w))
    .join(' ');
}

export function collectUniqueNewsTags(entries: CollectionEntry<'news'>[]): string[] {
  const set = new Set<string>();
  for (const e of entries) {
    for (const t of e.data.tags) {
      const s = t.trim();
      if (s) set.add(s);
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'en'));
}

export function filterNewsByTag(
  entries: CollectionEntry<'news'>[],
  tag: string,
): CollectionEntry<'news'>[] {
  return sortNewsByDateDesc(entries.filter((e) => e.data.tags.includes(tag)));
}

/**
 * Page 1 is `/news` or `/news/tag/T`.
 * Page 2+ is `/news/page/N` or `/news/tag/T/page/N`.
 */
export function newsListingHref(
  page: number,
  baseUrl: string,
  tag?: string | null,
): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const tagSeg = tag
    ? `news/tag/${encodeURIComponent(tag)}`
    : 'news';
  if (page <= 1) return `${base}${tagSeg}`;
  return `${base}${tagSeg}/page/${page}`;
}
