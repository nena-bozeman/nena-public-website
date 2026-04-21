import type { CollectionEntry } from 'astro:content';

export const NEWS_PER_PAGE = 10;

export function sortNewsByDateDesc(
  entries: CollectionEntry<'news'>[],
): CollectionEntry<'news'>[] {
  return [...entries].sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export function totalNewsPages(count: number): number {
  return Math.max(1, Math.ceil(count / NEWS_PER_PAGE));
}

/** Page 1 is `/news`; page 2+ is `/news/page/N`. */
export function newsListingHref(page: number, baseUrl: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  if (page <= 1) return `${base}news`;
  return `${base}news/page/${page}`;
}
