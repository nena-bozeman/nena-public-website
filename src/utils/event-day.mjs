/**
 * Upcoming vs past for NENA events, judged on the America/Denver calendar.
 *
 * Frontmatter datetimes are quoted Bozeman wall times with no offset
 * (`2026-11-09T23:00:00`). Astro coerces those strings with `new Date(string)`,
 * which stores the digits in the runtime's local calendar fields — on UTC CI
 * and on a Mountain Time laptop. Read those fields. Do not format the Date
 * instant in America/Denver: a 1:00 a.m. wall time built on UTC would become
 * the previous evening.
 *
 * "Today" is different. It is the real current instant, so it has to be
 * projected into America/Denver. An 11 p.m. Bozeman event is already the next
 * UTC date, and it still belongs to that Denver day.
 */

export const EVENT_TIME_ZONE = 'America/Denver';

/**
 * @param {unknown} value
 * @returns {value is Date}
 */
function isValidDate(value) {
  return value instanceof Date && !Number.isNaN(value.valueOf());
}

/**
 * @param {number} value
 * @returns {string}
 */
function pad(value) {
  return String(value).padStart(2, '0');
}

/**
 * YYYY-MM-DD of an instant in America/Denver.
 * @param {Date} instant
 * @returns {string}
 */
export function denverCalendarDate(instant) {
  if (!isValidDate(instant)) {
    throw new TypeError('Expected a valid instant');
  }
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: EVENT_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instant);
  const value = (type) => parts.find((part) => part.type === type)?.value ?? '';
  const year = value('year');
  const month = value('month');
  const day = value('day');
  if (!year || !month || !day) {
    throw new TypeError('Could not resolve the America/Denver calendar date');
  }
  return `${year}-${month}-${day}`;
}

/**
 * YYYY-MM-DD wall-clock date stored on an event Date. See the module note.
 * @param {Date} value
 * @returns {string}
 */
export function eventWallCalendarDate(value) {
  if (!isValidDate(value)) {
    throw new TypeError('Expected a valid event date');
  }
  return `${value.getFullYear()}-${pad(value.getMonth() + 1)}-${pad(value.getDate())}`;
}

/**
 * Day that decides the bucket: the end date when the event has one, otherwise the start date.
 * @param {{ startDate: Date, endDate?: Date | null }} event
 * @returns {string}
 */
export function eventActiveCalendarDate(event) {
  const end = event.endDate;
  const relevant = isValidDate(end) ? end : event.startDate;
  return eventWallCalendarDate(relevant);
}

/**
 * @param {string} eventDay YYYY-MM-DD
 * @param {string} today YYYY-MM-DD
 * @returns {boolean}
 */
export function isCalendarDatePast(eventDay, today) {
  return eventDay < today;
}

/**
 * Past once the event's Denver calendar day is over. Clock time does not matter.
 * @param {{ startDate: Date, endDate?: Date | null }} event
 * @param {Date} [now]
 * @returns {boolean}
 */
export function isEventPast(event, now = new Date()) {
  return isCalendarDatePast(eventActiveCalendarDate(event), denverCalendarDate(now));
}

/**
 * Upcoming through the whole Denver calendar day, including after the start time.
 * @param {{ startDate: Date, endDate?: Date | null }} event
 * @param {Date} [now]
 * @returns {boolean}
 */
export function isUpcoming(event, now = new Date()) {
  return !isEventPast(event, now);
}

/**
 * Indexes of the first `limit` days that are still today or later.
 * @param {string[]} calendarDays soonest first
 * @param {string} today
 * @param {number} limit
 * @returns {number[]}
 */
export function visibleUpcomingIndexes(calendarDays, today, limit) {
  /** @type {number[]} */
  const indexes = [];
  if (limit <= 0) return indexes;
  for (let i = 0; i < calendarDays.length; i += 1) {
    const day = calendarDays[i];
    if (day !== undefined && !isCalendarDatePast(day, today)) {
      indexes.push(i);
      if (indexes.length === limit) break;
    }
  }
  return indexes;
}

/**
 * Move events whose Denver day is over from upcoming into past.
 * Upcoming stays soonest-first. Past stays most-recent-first.
 * When `acceptMoved` is false, expired upcoming entries are dropped and past is unchanged
 * (used on later past-event pages, which do not show those cards).
 *
 * @template T
 * @param {T[]} upcoming
 * @param {T[]} past
 * @param {(item: T) => string} calendarDay
 * @param {string} today
 * @param {boolean} acceptMoved
 * @returns {{ upcoming: T[], past: T[] }}
 */
export function rebucketEvents(upcoming, past, calendarDay, today, acceptMoved) {
  /** @type {T[]} */
  const stillUpcoming = [];
  /** @type {T[]} */
  const moved = [];
  for (const item of upcoming) {
    if (isCalendarDatePast(calendarDay(item), today)) moved.push(item);
    else stillUpcoming.push(item);
  }
  if (!acceptMoved) return { upcoming: stillUpcoming, past: past.slice() };
  return { upcoming: stillUpcoming, past: [...moved].reverse().concat(past) };
}
