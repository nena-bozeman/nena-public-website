import { getCollection } from 'astro:content';
import { OUR_WORK_PATH } from '../data/our-work';

export type ContentCollection =
  | 'news'
  | 'events'
  | 'development'
  | 'history'
  | 'objectives'
  | 'meetings'
  | 'places';

export type BacklinkRef = {
  sourceCollection: ContentCollection;
  sourceSlug: string;
  title: string;
  date?: Date;
};

export type EntityKey = `${ContentCollection}:${string}`;

export function entityKey(collection: ContentCollection, slug: string): EntityKey {
  return `${collection}:${slug}`;
}

const INTERNAL_PATH_PATTERNS: {
  collection: ContentCollection;
  pattern: RegExp;
}[] = [
  { collection: 'places', pattern: /\/(?:places|businesses)\/([^/\s)#?]+)/g },
  { collection: 'development', pattern: /\/development\/([^/\s)#?]+)/g },
  { collection: 'history', pattern: /\/history\/([^/\s)#?]+)/g },
  { collection: 'objectives', pattern: /\/objectives\/([^/\s)#?]+)/g },
  { collection: 'events', pattern: /\/events\/([^/\s)#?]+)/g },
  { collection: 'news', pattern: /\/news\/([^/\s)#?]+)/g },
  {
    collection: 'meetings',
    pattern: /\/objectives\/nena-meetings\/([^/\s)#?]+)/g,
  },
];

const SKIP_SLUGS = new Set(['past', 'archive', 'nena-meetings']);

function addBacklink(
  index: Map<EntityKey, BacklinkRef[]>,
  target: EntityKey,
  ref: BacklinkRef,
): void {
  const existing = index.get(target) ?? [];
  const duplicate = existing.some(
    (r) =>
      r.sourceCollection === ref.sourceCollection && r.sourceSlug === ref.sourceSlug,
  );
  if (!duplicate) {
    existing.push(ref);
    index.set(target, existing);
  }
}

function scanBodyForLinks(
  body: string,
  ref: Omit<BacklinkRef, 'title' | 'date'>,
  index: Map<EntityKey, BacklinkRef[]>,
  title: string,
  date?: Date,
): void {
  for (const { collection, pattern } of INTERNAL_PATH_PATTERNS) {
    pattern.lastIndex = 0;
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(body)) !== null) {
      const slug = decodeURIComponent(match[1]!);
      if (SKIP_SLUGS.has(slug)) continue;
      addBacklink(index, entityKey(collection, slug), { ...ref, title, date });
    }
  }
}

function addExplicitRefs(
  index: Map<EntityKey, BacklinkRef[]>,
  source: ContentCollection,
  sourceSlug: string,
  title: string,
  date: Date | undefined,
  refs: { collection: ContentCollection; slug: string }[],
): void {
  const ref: Omit<BacklinkRef, 'title' | 'date'> = {
    sourceCollection: source,
    sourceSlug,
  };
  for (const { collection, slug } of refs) {
    addBacklink(index, entityKey(collection, slug), { ...ref, title, date });
  }
}

let cachedIndex: Map<EntityKey, BacklinkRef[]> | null = null;

/** Cached backlink index — built once per Astro build. */
export async function getBacklinkIndex(): Promise<Map<EntityKey, BacklinkRef[]>> {
  if (!cachedIndex) {
    cachedIndex = await buildBacklinkIndex();
  }
  return cachedIndex;
}

/** Build reverse-link index from markdown bodies and explicit frontmatter refs. */
export async function buildBacklinkIndex(): Promise<Map<EntityKey, BacklinkRef[]>> {
  const [news, events, development, history, objectives, meetings, places] =
    await Promise.all([
      getCollection('news'),
      getCollection('events'),
      getCollection('development'),
      getCollection('history'),
      getCollection('objectives'),
      getCollection('meetings'),
      getCollection('places'),
    ]);

  const index = new Map<EntityKey, BacklinkRef[]>();

  for (const post of news) {
    const title = post.data.title;
    const date = post.data.date;
    const ref = { sourceCollection: 'news' as const, sourceSlug: post.slug };
    scanBodyForLinks(post.body ?? '', ref, index, title, date);
    addExplicitRefs(index, 'news', post.slug, title, date, [
      ...(post.data.developments ?? []).map((slug) => ({
        collection: 'development' as const,
        slug,
      })),
      ...(post.data.places ?? []).map((slug) => ({
        collection: 'places' as const,
        slug,
      })),
      ...(post.data.meetings ?? []).map((slug) => ({
        collection: 'meetings' as const,
        slug,
      })),
      ...(post.data.events ?? []).map((slug) => ({
        collection: 'events' as const,
        slug,
      })),
    ]);
  }

  for (const event of events) {
    const title = event.data.title;
    const date = event.data.startDate;
    const ref = { sourceCollection: 'events' as const, sourceSlug: event.slug };
    scanBodyForLinks(event.body ?? '', ref, index, title, date);
    const refs: { collection: ContentCollection; slug: string }[] = [];
    if (event.data.meetingSlug) {
      refs.push({ collection: 'meetings', slug: event.data.meetingSlug });
    }
    for (const slug of event.data.newsSlugs ?? []) {
      refs.push({ collection: 'news', slug });
    }
    addExplicitRefs(index, 'events', event.slug, title, date, refs);
  }

  for (const meeting of meetings) {
    const title = meeting.data.title;
    const date = meeting.data.meetingDate;
    const ref = { sourceCollection: 'meetings' as const, sourceSlug: meeting.slug };
    scanBodyForLinks(meeting.body ?? '', ref, index, title, date);
    const refs: { collection: ContentCollection; slug: string }[] = [];
    if (meeting.data.eventSlug) {
      refs.push({ collection: 'events', slug: meeting.data.eventSlug });
    }
    for (const slug of meeting.data.newsSlugs ?? []) {
      refs.push({ collection: 'news', slug });
    }
    addExplicitRefs(index, 'meetings', meeting.slug, title, date, refs);
  }

  for (const project of development) {
    const title = project.data.title;
    const date = project.data.dateUpdated;
    const ref = { sourceCollection: 'development' as const, sourceSlug: project.slug };
    scanBodyForLinks(project.body ?? '', ref, index, title, date);
    for (const slug of project.data.newsSlugs ?? []) {
      addExplicitRefs(index, 'development', project.slug, title, date, [
        { collection: 'news', slug },
      ]);
    }
  }

  for (const entry of history) {
    const title = entry.data.title;
    const date = new Date(entry.data.year, 0, 1);
    const ref = { sourceCollection: 'history' as const, sourceSlug: entry.slug };
    scanBodyForLinks(entry.body ?? '', ref, index, title, date);
    if (entry.data.placeSlug) {
      addExplicitRefs(index, 'history', entry.slug, title, date, [
        { collection: 'places', slug: entry.data.placeSlug },
      ]);
    }
  }

  for (const place of places) {
    const title = place.data.name;
    const ref = { sourceCollection: 'places' as const, sourceSlug: place.slug };
    scanBodyForLinks(place.body ?? '', ref, index, title);
    if (place.data.historySlug) {
      addExplicitRefs(index, 'places', place.slug, title, undefined, [
        { collection: 'history', slug: place.data.historySlug },
      ]);
    }
  }

  for (const objective of objectives) {
    const title = objective.data.title;
    const ref = { sourceCollection: 'objectives' as const, sourceSlug: objective.slug };
    scanBodyForLinks(objective.body ?? '', ref, index, title);
  }

  return index;
}

export function getBacklinksFor(
  index: Map<EntityKey, BacklinkRef[]>,
  collection: ContentCollection,
  slug: string,
): BacklinkRef[] {
  const links = index.get(entityKey(collection, slug)) ?? [];
  return [...links].sort((a, b) => {
    const aTime = a.date?.valueOf() ?? 0;
    const bTime = b.date?.valueOf() ?? 0;
    return bTime - aTime;
  });
}

export function backlinkHref(ref: BacklinkRef, baseUrl: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  switch (ref.sourceCollection) {
    case 'meetings':
      return `${base}${OUR_WORK_PATH}/nena-meetings/${ref.sourceSlug}`;
    case 'news':
      return `${base}news/${ref.sourceSlug}`;
    case 'events':
      return `${base}events/${ref.sourceSlug}`;
    case 'development':
      return `${base}development/${ref.sourceSlug}`;
    case 'history':
      return `${base}history/${ref.sourceSlug}`;
    case 'places':
      return `${base}places/${ref.sourceSlug}`;
    case 'objectives':
      return `${base}${OUR_WORK_PATH}/${ref.sourceSlug}`;
  }
}

export function backlinkCollectionLabel(collection: ContentCollection): string {
  switch (collection) {
    case 'news':
      return 'News';
    case 'events':
      return 'Events';
    case 'development':
      return 'Development';
    case 'history':
      return 'History';
    case 'places':
      return 'Places';
    case 'meetings':
      return 'Meetings';
    case 'objectives':
      return 'Objectives';
  }
}

export function entityPageHref(
  collection: ContentCollection,
  slug: string,
  baseUrl: string,
): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  switch (collection) {
    case 'meetings':
      return `${base}${OUR_WORK_PATH}/nena-meetings/${slug}`;
    case 'places':
      return `${base}places/${slug}`;
    default:
      return `${base}${collection}/${slug}`;
  }
}
