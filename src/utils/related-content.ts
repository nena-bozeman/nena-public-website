import type { CollectionEntry } from 'astro:content';
import { getCollection } from 'astro:content';
import type { Topic } from '../schemas/topics';
import {
  eventsMatchingTopics,
  newsMatchingTopics,
  objectivesForTopic,
  sortNewsByDateDesc,
} from './content-relationships';
import {
  entityPageHref,
  getBacklinkIndex,
  getBacklinksFor,
  type BacklinkRef,
  type ContentCollection,
  type EntityKey,
} from './backlinks';
import { newsEntriesForSite } from './news';

export type RelatedPageLink = {
  href: string;
  title: string;
  subtitle?: string;
};

export async function loadSiteContent() {
  const [news, events, objectives, meetings, places, history, development, backlinkIndex] =
    await Promise.all([
      getCollection('news'),
      getCollection('events'),
      getCollection('objectives'),
      getCollection('meetings'),
      getCollection('places'),
      getCollection('history'),
      getCollection('development'),
      getBacklinkIndex(),
    ]);
  return {
    news: newsEntriesForSite(news),
    events,
    objectives,
    meetings,
    places,
    history,
    development,
    backlinkIndex,
  };
}

export function backlinksFor(
  backlinkIndex: Map<EntityKey, BacklinkRef[]>,
  collection: ContentCollection,
  slug: string,
): BacklinkRef[] {
  return getBacklinksFor(backlinkIndex, collection, slug);
}

export function relatedNewsByTopics(
  news: CollectionEntry<'news'>[],
  topics: Topic[],
  excludeSlug?: string,
): CollectionEntry<'news'>[] {
  const posts = newsMatchingTopics(news, topics);
  return excludeSlug ? posts.filter((p) => p.slug !== excludeSlug) : posts;
}

export function relatedEventsByTopics(
  events: CollectionEntry<'events'>[],
  topics: Topic[],
  excludeSlug?: string,
): CollectionEntry<'events'>[] {
  const matched = eventsMatchingTopics(events, topics);
  return excludeSlug ? matched.filter((e) => e.slug !== excludeSlug) : matched;
}

export function relatedObjectivesByTopics(
  objectives: CollectionEntry<'objectives'>[],
  topics: Topic[],
): CollectionEntry<'objectives'>[] {
  const seen = new Set<string>();
  const result: CollectionEntry<'objectives'>[] = [];
  for (const topic of topics) {
    for (const objective of objectivesForTopic(objectives, topic)) {
      if (!seen.has(objective.slug)) {
        seen.add(objective.slug);
        result.push(objective);
      }
    }
  }
  return result.sort((a, b) => a.data.order - b.data.order);
}

export function resolveRelatedPages(
  links: RelatedPageLink[],
): RelatedPageLink[] {
  return links;
}

export async function meetingRelatedPages(
  meeting: CollectionEntry<'meetings'>,
  content: Awaited<ReturnType<typeof loadSiteContent>>,
  baseUrl: string,
): Promise<RelatedPageLink[]> {
  const pages: RelatedPageLink[] = [];
  if (meeting.data.eventSlug) {
    const event = content.events.find((e) => e.slug === meeting.data.eventSlug);
    if (event) {
      pages.push({
        href: entityPageHref('events', event.slug, baseUrl),
        title: event.data.title,
        subtitle: event.data.startDate.toLocaleDateString('en-US', {
          weekday: 'long',
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        }),
      });
    }
  }
  for (const slug of meeting.data.newsSlugs ?? []) {
    const post = content.news.find((p) => p.slug === slug);
    if (post) {
      pages.push({
        href: entityPageHref('news', post.slug, baseUrl),
        title: post.data.title,
        subtitle: post.data.date.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        }),
      });
    }
  }
  return pages;
}

export async function eventRelatedPages(
  event: CollectionEntry<'events'>,
  content: Awaited<ReturnType<typeof loadSiteContent>>,
  baseUrl: string,
): Promise<RelatedPageLink[]> {
  const pages: RelatedPageLink[] = [];
  if (event.data.meetingSlug) {
    const meeting = content.meetings.find((m) => m.slug === event.data.meetingSlug);
    if (meeting) {
      pages.push({
        href: entityPageHref('meetings', meeting.slug, baseUrl),
        title: meeting.data.title,
        subtitle: meeting.data.meetingDate.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        }),
      });
    }
  }
  for (const slug of event.data.newsSlugs ?? []) {
    const post = content.news.find((p) => p.slug === slug);
    if (post) {
      pages.push({
        href: entityPageHref('news', post.slug, baseUrl),
        title: post.data.title,
        subtitle: post.data.date.toLocaleDateString('en-US', {
          month: 'long',
          day: 'numeric',
          year: 'numeric',
        }),
      });
    }
  }
  return pages;
}

export function historyPlaceLink(
  entry: CollectionEntry<'history'>,
  places: CollectionEntry<'places'>[],
  baseUrl: string,
): RelatedPageLink | null {
  if (!entry.data.placeSlug) return null;
  const place = places.find((p) => p.slug === entry.data.placeSlug);
  if (!place) return null;
  return {
    href: entityPageHref('places', place.slug, baseUrl),
    title: place.data.name,
    subtitle: place.data.address,
  };
}

export function placeHistoryLink(
  place: CollectionEntry<'places'>,
  history: CollectionEntry<'history'>[],
  baseUrl: string,
): RelatedPageLink | null {
  return placeHistoryLinks(place, history, baseUrl)[0] ?? null;
}

/** History timeline entries linked via `historySlug` or `placeSlug`. */
export function placeHistoryLinks(
  place: CollectionEntry<'places'>,
  history: CollectionEntry<'history'>[],
  baseUrl: string,
): RelatedPageLink[] {
  const slugs = new Set<string>();
  if (place.data.historySlug) slugs.add(place.data.historySlug);
  for (const entry of history) {
    if (entry.data.placeSlug === place.slug) slugs.add(entry.slug);
  }
  return [...slugs]
    .map((slug) => history.find((h) => h.slug === slug))
    .filter((entry): entry is CollectionEntry<'history'> => Boolean(entry))
    .sort((a, b) => a.data.year - b.data.year)
    .map((entry) => ({
      href: entityPageHref('history', entry.slug, baseUrl),
      title: entry.data.title,
      subtitle: `${entry.data.year} — neighborhood history`,
    }));
}

export function newsBySlugs(
  news: CollectionEntry<'news'>[],
  slugs: string[],
): CollectionEntry<'news'>[] {
  return slugs
    .map((slug) => news.find((p) => p.slug === slug))
    .filter((p): p is CollectionEntry<'news'> => Boolean(p));
}

/** News posts with this place in frontmatter `places`. */
export function newsReferencingPlace(
  news: CollectionEntry<'news'>[],
  placeSlug: string,
): CollectionEntry<'news'>[] {
  return sortNewsByDateDesc(
    news.filter((post) => (post.data.places ?? []).includes(placeSlug)),
  );
}
