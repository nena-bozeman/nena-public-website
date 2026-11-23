import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  denverCalendarDate,
  eventActiveCalendarDate,
  eventWallCalendarDate,
  isEventPast,
  isUpcoming,
  rebucketEvents,
  visibleUpcomingIndexes,
} from './event-day.mjs';

/** Zoneless frontmatter, same coercion Astro applies to quoted event datetimes. */
function wallClock(value) {
  return new Date(value);
}

test('an event earlier today stays upcoming after its start and end time', () => {
  const event = {
    startDate: wallClock('2026-11-09T09:00:00'),
    endDate: wallClock('2026-11-09T10:00:00'),
  };
  // 3:00 p.m. MST on November 9.
  const now = new Date('2026-11-09T22:00:00.000Z');
  assert.equal(denverCalendarDate(now), '2026-11-09');
  assert.equal(eventActiveCalendarDate(event), '2026-11-09');
  assert.equal(isEventPast(event, now), false);
  assert.equal(isUpcoming(event, now), true);
});

test('11 p.m. Denver is still that calendar day when UTC has already rolled over', () => {
  const event = {
    startDate: wallClock('2026-11-09T23:00:00'),
    endDate: wallClock('2026-11-09T23:30:00'),
  };
  // 11:30 p.m. MST on November 9 is 6:30 a.m. UTC on November 10.
  const now = new Date('2026-11-10T06:30:00.000Z');
  assert.equal(denverCalendarDate(now), '2026-11-09');
  assert.equal(eventWallCalendarDate(event.startDate), '2026-11-09');
  assert.equal(isUpcoming(event, now), true);

  // The same clock time in July is MDT (UTC−6), so 11:30 p.m. is 5:30 a.m. UTC the next day.
  const summerEvent = { startDate: wallClock('2026-07-08T23:00:00') };
  const summerNow = new Date('2026-07-09T05:30:00.000Z');
  assert.equal(denverCalendarDate(summerNow), '2026-07-08');
  assert.equal(isUpcoming(summerEvent, summerNow), true);
});

test('the Denver day after an 11 p.m. event is past, including just after midnight', () => {
  const event = {
    startDate: wallClock('2026-11-09T23:00:00'),
    endDate: wallClock('2026-11-09T23:30:00'),
  };
  // 12:30 a.m. MST on November 10.
  const now = new Date('2026-11-10T07:30:00.000Z');
  assert.equal(denverCalendarDate(now), '2026-11-10');
  assert.equal(isEventPast(event, now), true);
});

test("yesterday's event is past", () => {
  const event = {
    startDate: wallClock('2026-11-08T18:00:00'),
    endDate: wallClock('2026-11-08T20:00:00'),
  };
  // 8:00 a.m. MST on November 9.
  const now = new Date('2026-11-09T15:00:00.000Z');
  assert.equal(isEventPast(event, now), true);
  assert.equal(isUpcoming(event, now), false);
});

test('a multi-day event stays upcoming through the end date and moves the next Denver day', () => {
  const event = {
    startDate: wallClock('2026-11-08T10:00:00'),
    endDate: wallClock('2026-11-10T15:00:00'),
  };
  assert.equal(eventActiveCalendarDate(event), '2026-11-10');

  // Start day is over, end day has not begun.
  assert.equal(isUpcoming(event, new Date('2026-11-09T18:00:00.000Z')), true);
  // 1:00 a.m. MST on the end date, hours after the start clock time.
  assert.equal(isUpcoming(event, new Date('2026-11-10T08:00:00.000Z')), true);
  // 8:00 p.m. MST on the end date, after the 3:00 p.m. end time.
  assert.equal(isUpcoming(event, new Date('2026-11-11T03:00:00.000Z')), true);
  // Midnight MST at the start of the next day.
  assert.equal(isEventPast(event, new Date('2026-11-11T07:00:00.000Z')), true);
});

test('an event with no end date uses the start date day', () => {
  const event = { startDate: wallClock('2026-11-09T09:00:00') };
  assert.equal(eventActiveCalendarDate(event), '2026-11-09');
  assert.equal(isUpcoming(event, new Date('2026-11-09T22:00:00.000Z')), true);
  assert.equal(isEventPast(event, new Date('2026-11-10T07:00:00.000Z')), true);
});

test('homepage slots skip events whose Denver day has ended and keep the next ones', () => {
  const days = ['2026-11-09', '2026-11-12', '2026-11-15', '2026-11-20'];
  assert.deepEqual(visibleUpcomingIndexes(days, '2026-11-09', 3), [0, 1, 2]);
  assert.deepEqual(visibleUpcomingIndexes(days, '2026-11-10', 3), [1, 2, 3]);
});

test('rebucket keeps same-day events upcoming and orders newly past events newest first', () => {
  const upcoming = [
    { id: 'morning', day: '2026-11-09' },
    { id: 'late', day: '2026-11-09' },
    { id: 'multi-day', day: '2026-11-10' },
  ];
  const past = [{ id: 'older', day: '2026-11-08' }];
  const stillToday = rebucketEvents(upcoming, past, (event) => event.day, '2026-11-09', true);
  assert.deepEqual(stillToday.upcoming.map((event) => event.id), ['morning', 'late', 'multi-day']);
  assert.deepEqual(stillToday.past.map((event) => event.id), ['older']);

  const nextDay = rebucketEvents(upcoming, past, (event) => event.day, '2026-11-10', true);
  assert.deepEqual(nextDay.upcoming.map((event) => event.id), ['multi-day']);
  assert.deepEqual(nextDay.past.map((event) => event.id), ['late', 'morning', 'older']);

  const otherPage = rebucketEvents(upcoming, past, (event) => event.day, '2026-11-10', false);
  assert.deepEqual(otherPage.upcoming.map((event) => event.id), ['multi-day']);
  assert.deepEqual(otherPage.past.map((event) => event.id), ['older']);
});

test('wall-clock event days and Denver today ignore the process timezone', () => {
  const moduleUrl = fileURLToPath(new URL('./event-day.mjs', import.meta.url));
  const script = `
    import {
      denverCalendarDate,
      eventWallCalendarDate,
      isUpcoming,
    } from ${JSON.stringify(moduleUrl)};
    const oneAm = new Date('2026-11-09T01:00:00');
    if (eventWallCalendarDate(oneAm) !== '2026-11-09') {
      console.error('1am wall clock shifted', eventWallCalendarDate(oneAm));
      process.exit(2);
    }
    const elevenPm = new Date('2026-11-10T06:00:00.000Z');
    if (denverCalendarDate(elevenPm) !== '2026-11-09') {
      console.error('11pm Denver instant', denverCalendarDate(elevenPm));
      process.exit(3);
    }
    const event = {
      startDate: new Date('2026-11-09T23:00:00'),
      endDate: new Date('2026-11-09T23:30:00'),
    };
    if (!isUpcoming(event, new Date('2026-11-10T06:30:00.000Z'))) {
      console.error('11:30pm Denver was treated as past');
      process.exit(4);
    }
  `;
  for (const tz of ['UTC', 'America/Denver', 'Pacific/Auckland']) {
    const result = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
      env: { ...process.env, TZ: tz },
      encoding: 'utf8',
    });
    assert.equal(
      result.status,
      0,
      `${tz} exited ${result.status}\n${result.stdout}\n${result.stderr}`,
    );
  }
});
