import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CANCELLED_PREFIX,
  CALENDAR_SYNC_ALLOW_ENV,
  EVENT_TIME_ZONE,
  addHoursToDateTime,
  assertCalendarSyncAllowed,
  buildEventDescription,
  buildGoogleCalendarEvent,
  computeContentHash,
  formatEventLocation,
  formatEventSummary,
  formatInlineMarkdown,
  markdownBodyToCalendarHtml,
  normalizeDateTime,
  planSyncActions,
  resolveEventEnd,
  validateLocalEvent,
} from './lib/google-calendar-sync.mjs';

const SITE_URL = 'https://example.com';

/** @returns {import('./lib/google-calendar-sync.mjs').LocalEvent} */
function sampleEvent(overrides = {}) {
  return {
    slug: '2026-07-08-sample-event',
    title: 'Sample Event',
    startDate: '2026-07-08T18:00:00',
    endDate: '2026-07-08T19:00:00',
    location: 'Beall Park',
    address: '415 N Black Ave, Bozeman, MT 59715',
    summary: 'A neighborhood gathering.',
    cancelled: false,
    externalUrl: 'https://example.com/tickets',
    body: 'Bring a friend.',
    ...overrides,
  };
}

test('assertCalendarSyncAllowed permits dry-run without production flag', () => {
  const previous = process.env[CALENDAR_SYNC_ALLOW_ENV];
  delete process.env[CALENDAR_SYNC_ALLOW_ENV];
  try {
    assert.doesNotThrow(() => assertCalendarSyncAllowed({ dryRun: true }));
  } finally {
    if (previous === undefined) delete process.env[CALENDAR_SYNC_ALLOW_ENV];
    else process.env[CALENDAR_SYNC_ALLOW_ENV] = previous;
  }
});

test('assertCalendarSyncAllowed blocks live sync without production flag', () => {
  const previous = process.env[CALENDAR_SYNC_ALLOW_ENV];
  delete process.env[CALENDAR_SYNC_ALLOW_ENV];
  try {
    assert.throws(
      () => assertCalendarSyncAllowed({ dryRun: false }),
      /Refusing to write to Google Calendar/,
    );
  } finally {
    if (previous === undefined) delete process.env[CALENDAR_SYNC_ALLOW_ENV];
    else process.env[CALENDAR_SYNC_ALLOW_ENV] = previous;
  }
});

test('assertCalendarSyncAllowed permits live sync when production flag is set', () => {
  const previous = process.env[CALENDAR_SYNC_ALLOW_ENV];
  process.env[CALENDAR_SYNC_ALLOW_ENV] = '1';
  try {
    assert.doesNotThrow(() => assertCalendarSyncAllowed({ dryRun: false }));
  } finally {
    if (previous === undefined) delete process.env[CALENDAR_SYNC_ALLOW_ENV];
    else process.env[CALENDAR_SYNC_ALLOW_ENV] = previous;
  }
});

test('formatEventSummary adds and removes cancelled prefix', () => {
  assert.equal(formatEventSummary('Potluck', false), 'Potluck');
  assert.equal(formatEventSummary('Potluck', true), `${CANCELLED_PREFIX}Potluck`);
  assert.equal(
    formatEventSummary(`${CANCELLED_PREFIX}Potluck`, true),
    `${CANCELLED_PREFIX}Potluck`,
  );
  assert.equal(
    formatEventSummary(`${CANCELLED_PREFIX}Potluck`, false),
    'Potluck',
  );
});

test('normalizeDateTime treats all values as America/Denver wall clock', () => {
  assert.deepEqual(normalizeDateTime('2026-07-08T18:00:00'), {
    dateTime: '2026-07-08T18:00:00',
    timeZone: EVENT_TIME_ZONE,
  });
  assert.deepEqual(normalizeDateTime('2026-06-11T17:30:00.000Z'), {
    dateTime: '2026-06-11T17:30:00',
    timeZone: EVENT_TIME_ZONE,
  });
});

test('resolveEventEnd defaults to one hour after start', () => {
  assert.deepEqual(
    resolveEventEnd('2026-07-08T18:00:00', undefined),
    { dateTime: '2026-07-08T19:00:00', timeZone: EVENT_TIME_ZONE },
  );
  assert.deepEqual(
    resolveEventEnd('2026-06-11T17:30:00.000Z', undefined),
    { dateTime: '2026-06-11T18:30:00', timeZone: EVENT_TIME_ZONE },
  );
});

test('addHoursToDateTime rolls local dates across midnight', () => {
  assert.deepEqual(
    addHoursToDateTime(
      { dateTime: '2026-07-08T23:30:00', timeZone: EVENT_TIME_ZONE },
      1,
    ),
    { dateTime: '2026-07-09T00:30:00', timeZone: EVENT_TIME_ZONE },
  );
});

test('formatEventLocation combines location and address', () => {
  assert.equal(
    formatEventLocation('Beall Park', '415 N Black Ave, Bozeman, MT 59715'),
    'Beall Park — 415 N Black Ave, Bozeman, MT 59715',
  );
  assert.equal(formatEventLocation('Beall Park', ''), 'Beall Park');
});

test('formatInlineMarkdown converts links and bold text', () => {
  const html = formatInlineMarkdown(
    'Visit [Indreland Audubon Wetland Preserve](/places/indreland-audubon-wetland-preserve) on **Wednesday**.',
    SITE_URL,
  );
  assert.match(html, /<a href="https:\/\/example.com\/places\/indreland-audubon-wetland-preserve">Indreland Audubon Wetland Preserve<\/a>/);
  assert.match(html, /<b>Wednesday<\/b>/);
});

test('markdownBodyToCalendarHtml preserves paragraphs and line breaks', () => {
  const html = markdownBodyToCalendarHtml(
    'First paragraph.\n\nSecond **line**.',
    SITE_URL,
  );
  assert.match(html, /First paragraph\.<br><br>Second <b>line<\/b>\./);
});

test('buildEventDescription uses body only and formats HTML footers', () => {
  const description = buildEventDescription(
    'Short summary',
    'Longer body with [a link](/events/foo).',
    'https://example.com/events/sample',
    'https://example.com/tickets',
    SITE_URL,
  );
  assert.doesNotMatch(description, /Short summary/);
  assert.match(description, /Longer body with <a href="https:\/\/example.com\/events\/foo">a link<\/a>/);
  assert.match(description, /View event on NENA website/);
  assert.match(description, /Register \/ RSVP/);
});

test('buildEventDescription skips duplicate RSVP link when body already includes externalUrl', () => {
  const description = buildEventDescription(
    'Summary only',
    'Please [RSVP on Partiful](https://partiful.com/e/abc) for details.',
    'https://example.com/events/sample',
    'https://partiful.com/e/abc',
    SITE_URL,
  );
  assert.match(description, /RSVP on Partiful/);
  assert.doesNotMatch(description, /Register \/ RSVP/);
});

test('buildEventDescription falls back to summary when body is empty', () => {
  const description = buildEventDescription(
    'Short summary',
    '',
    'https://example.com/events/sample',
    undefined,
    SITE_URL,
  );
  assert.match(description, /Short summary/);
  assert.match(description, /View event on NENA website/);
});

test('buildGoogleCalendarEvent maps fields and extended properties', () => {
  const payload = buildGoogleCalendarEvent(
    sampleEvent(),
    'https://example.com',
  );

  assert.equal(payload.summary, 'Sample Event');
  assert.equal(
    payload.location,
    'Beall Park — 415 N Black Ave, Bozeman, MT 59715',
  );
  assert.deepEqual(payload.start, {
    dateTime: '2026-07-08T18:00:00',
    timeZone: EVENT_TIME_ZONE,
  });
  assert.equal(payload.source?.url, 'https://example.com/events/2026-07-08-sample-event');
  assert.equal(payload.extendedProperties?.private?.nenaSource, 'website');
  assert.equal(payload.extendedProperties?.private?.nenaSlug, '2026-07-08-sample-event');
  assert.match(payload.extendedProperties?.private?.nenaContentHash ?? '', /^[a-f0-9]{64}$/);
});

test('buildGoogleCalendarEvent prefixes cancelled titles', () => {
  const payload = buildGoogleCalendarEvent(
    sampleEvent({ cancelled: true }),
    'https://example.com',
  );
  assert.equal(payload.summary, `${CANCELLED_PREFIX}Sample Event`);
});

test('computeContentHash changes when synced fields change', () => {
  const base = sampleEvent();
  const changed = sampleEvent({ body: 'Updated body copy.' });
  assert.notEqual(
    computeContentHash(base, SITE_URL),
    computeContentHash(changed, SITE_URL),
  );
});

test('validateLocalEvent rejects missing required fields', () => {
  assert.throws(
    () => validateLocalEvent(sampleEvent({ title: '' })),
    /missing required field: title/,
  );
});

test('planSyncActions plans create, update, delete, and skip', () => {
  const local = new Map([
    ['new-event', sampleEvent({ slug: 'new-event' })],
    ['changed-event', sampleEvent({ slug: 'changed-event', title: 'Changed' })],
    ['same-event', sampleEvent({ slug: 'same-event' })],
  ]);

  const sameHash = computeContentHash(local.get('same-event'), SITE_URL);
  const remote = [
    {
      id: 'remote-changed',
      extendedProperties: {
        private: {
          nenaSlug: 'changed-event',
          nenaContentHash: 'old-hash',
        },
      },
    },
    {
      id: 'remote-same',
      extendedProperties: {
        private: {
          nenaSlug: 'same-event',
          nenaContentHash: sameHash,
        },
      },
    },
    {
      id: 'remote-stale',
      extendedProperties: {
        private: {
          nenaSlug: 'removed-event',
          nenaContentHash: 'stale-hash',
        },
      },
    },
  ];

  const actions = planSyncActions(local, remote, SITE_URL);

  assert.deepEqual(
    actions.create.map((action) => action.slug),
    ['new-event'],
  );
  assert.deepEqual(
    actions.update.map((action) => action.slug),
    ['changed-event'],
  );
  assert.deepEqual(
    actions.delete.map((action) => action.slug),
    ['removed-event'],
  );
  assert.deepEqual(
    actions.skip.map((action) => action.slug),
    ['same-event'],
  );
});
