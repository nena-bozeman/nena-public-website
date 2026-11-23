import {
  denverCalendarDate,
  rebucketEvents,
  visibleUpcomingIndexes,
} from '../utils/event-day.mjs';

/**
 * Static HTML is bucketed at build time. The Denver day only changes at
 * midnight, so a later visit re-buckets the cards already on the page.
 */
function eventDay(card: HTMLElement): string {
  return card.dataset.eventDay ?? '';
}

function cardsIn(root: ParentNode | null): HTMLElement[] {
  if (!root) return [];
  return [...root.querySelectorAll<HTMLElement>(':scope > [data-event-day]')];
}

function setEmptyState(bucket: ParentNode): void {
  const empty = bucket.querySelector<HTMLElement>('[data-event-empty]');
  if (!empty) return;
  empty.hidden = bucket.querySelector('[data-event-day]') !== null;
}

function refreshUpcomingLimit(root: ParentNode, today: string): void {
  for (const region of root.querySelectorAll<HTMLElement>('[data-upcoming-limit]')) {
    const parsed = Number(region.dataset.upcomingLimit);
    const limit = Number.isFinite(parsed) && parsed > 0 ? parsed : 3;
    const cards = [...region.querySelectorAll<HTMLElement>('[data-event-day]')];
    const visible = new Set(visibleUpcomingIndexes(cards.map(eventDay), today, limit));
    cards.forEach((card, index) => {
      card.hidden = !visible.has(index);
    });
    const empty = region.querySelector<HTMLElement>('[data-upcoming-empty]');
    if (empty) empty.hidden = visible.size > 0;
  }
}

function refreshEventSplit(root: ParentNode, today: string): void {
  for (const region of root.querySelectorAll<HTMLElement>('[data-event-split]')) {
    const upcomingBucket = region.querySelector<HTMLElement>('[data-event-bucket="upcoming"]');
    const pastBucket = region.querySelector<HTMLElement>('[data-event-bucket="past"]');
    const upcomingRoot = upcomingBucket?.querySelector<HTMLElement>('[data-event-cards]') ?? null;
    const pastRoot = pastBucket?.querySelector<HTMLElement>('[data-event-cards]') ?? null;
    if (!upcomingBucket || !upcomingRoot) continue;

    const acceptMoved = region.dataset.acceptMoved === 'true';
    const upcomingCards = cardsIn(upcomingRoot);
    const pastCards = cardsIn(pastRoot);
    const next = rebucketEvents(upcomingCards, pastCards, eventDay, today, acceptMoved);

    for (const card of upcomingCards) {
      if (!next.upcoming.includes(card)) card.remove();
    }
    for (const card of next.upcoming) upcomingRoot.appendChild(card);

    if (acceptMoved && pastRoot) {
      for (const card of next.past) pastRoot.appendChild(card);
    }

    setEmptyState(upcomingBucket);
    if (pastBucket) setEmptyState(pastBucket);
  }
}

function refreshEventDays(): void {
  const today = denverCalendarDate(new Date());
  refreshUpcomingLimit(document, today);
  refreshEventSplit(document, today);
}

refreshEventDays();
