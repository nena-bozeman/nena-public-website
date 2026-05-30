import type { CollectionEntry } from 'astro:content';
import type { Topic } from '../schemas/topics';

type TopicEntry =
  | CollectionEntry<'news'>
  | CollectionEntry<'events'>
  | CollectionEntry<'objectives'>
  | CollectionEntry<'development'>
  | CollectionEntry<'meetings'>
  | CollectionEntry<'history'>
  | CollectionEntry<'places'>;

function hasTopics(entry: TopicEntry): entry is TopicEntry & { data: { topics: Topic[] } } {
  return 'topics' in entry.data && Array.isArray(entry.data.topics);
}

/** Entries that include at least one of the given topics (OR). */
export function entriesMatchingAnyTopic<T extends TopicEntry>(
  entries: T[],
  topics: Topic[],
): T[] {
  if (topics.length === 0) return [];
  const topicSet = new Set(topics);
  return entries.filter(
    (e) => hasTopics(e) && e.data.topics.some((t) => topicSet.has(t)),
  );
}

export function sortNewsByDateDesc(
  entries: CollectionEntry<'news'>[],
): CollectionEntry<'news'>[] {
  return [...entries].sort((a, b) => b.data.date.valueOf() - a.data.date.valueOf());
}

export function sortEventsUpcomingFirst(
  entries: CollectionEntry<'events'>[],
  now = new Date(),
): CollectionEntry<'events'>[] {
  const upcoming = entries
    .filter((e) => e.data.startDate.valueOf() >= now.valueOf())
    .sort((a, b) => a.data.startDate.valueOf() - b.data.startDate.valueOf());
  const past = entries
    .filter((e) => e.data.startDate.valueOf() < now.valueOf())
    .sort((a, b) => b.data.startDate.valueOf() - a.data.startDate.valueOf());
  return [...upcoming, ...past];
}

export function sortMeetingsByDateDesc(
  entries: CollectionEntry<'meetings'>[],
): CollectionEntry<'meetings'>[] {
  return [...entries].sort(
    (a, b) => b.data.meetingDate.valueOf() - a.data.meetingDate.valueOf(),
  );
}

/** Objectives whose `topics` include the given topic. */
export function objectivesForTopic(
  allObjectives: CollectionEntry<'objectives'>[],
  topic: Topic,
): CollectionEntry<'objectives'>[] {
  return allObjectives.filter(
    (o) =>
      o.slug !== 'nena-meetings' &&
      o.slug !== 'nena-newsletters' &&
      hasTopics(o) &&
      o.data.topics.includes(topic),
  );
}

export function newsMatchingTopics(
  entries: CollectionEntry<'news'>[],
  topics: Topic[],
): CollectionEntry<'news'>[] {
  return sortNewsByDateDesc(entriesMatchingAnyTopic(entries, topics));
}

export function eventsMatchingTopics(
  entries: CollectionEntry<'events'>[],
  topics: Topic[],
): CollectionEntry<'events'>[] {
  return sortEventsUpcomingFirst(entriesMatchingAnyTopic(entries, topics));
}

export function collectUniqueTopicsFromEntries(
  entries: TopicEntry[],
): Topic[] {
  const set = new Set<Topic>();
  for (const e of entries) {
    if (hasTopics(e)) {
      for (const t of e.data.topics) {
        set.add(t);
      }
    }
  }
  return [...set].sort((a, b) => a.localeCompare(b, 'en'));
}
