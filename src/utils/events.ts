import type { CollectionEntry } from 'astro:content';
import { isEventPast } from './event-day.mjs';

export const EVENTS_PER_PAGE = 10;

export function splitEventsByDay(
  entries: CollectionEntry<'events'>[],
  now = new Date(),
): { upcoming: CollectionEntry<'events'>[]; past: CollectionEntry<'events'>[] } {
  const upcoming: CollectionEntry<'events'>[] = [];
  const past: CollectionEntry<'events'>[] = [];
  for (const entry of entries) {
    if (isEventPast(entry.data, now)) past.push(entry);
    else upcoming.push(entry);
  }
  return {
    upcoming: sortUpcomingEventsAsc(upcoming),
    past: sortPastEventsDesc(past),
  };
}

export function sortUpcomingEventsAsc(
  entries: CollectionEntry<'events'>[],
): CollectionEntry<'events'>[] {
  return [...entries].sort(
    (a, b) => a.data.startDate.valueOf() - b.data.startDate.valueOf(),
  );
}

export function sortPastEventsDesc(
  entries: CollectionEntry<'events'>[],
): CollectionEntry<'events'>[] {
  return [...entries].sort(
    (a, b) => b.data.startDate.valueOf() - a.data.startDate.valueOf(),
  );
}

/** Pagination applies to past events only; page 1 is `/events`. */
export function totalPastEventPages(count: number): number {
  return Math.max(1, Math.ceil(count / EVENTS_PER_PAGE));
}

/** Page 1 is `/events`; page 2+ is `/events/page/N`. */
export function eventsListingHref(page: number, baseUrl: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  if (page <= 1) return `${base}events`;
  return `${base}events/page/${page}`;
}
