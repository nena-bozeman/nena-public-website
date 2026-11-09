import assert from 'node:assert/strict';
import test from 'node:test';
import yaml from 'js-yaml';
import { classifyExtractedEvents, extractCampaignEvents } from './mailchimp-campaign-events.mjs';

const SOURCE = 'Join neighbors Thursday, August 6, 4:30 p.m. at 702 E. Peach. RSVP at https://partiful.com/e/potluck';
const ARCHIVE = 'https://mailchi.mp/bbbbbbbbbbbbbbbb/neighborhood-potluck';
const NOW = new Date('2026-11-09T18:00:00Z');
const NEWS = '2026-08-04-neighborhood-potluck';

function item(overrides = {}) {
  return {
    title: 'Planning meeting',
    start: '2026-12-01T16:30:00',
    end: '2026-12-01T18:00:00',
    location: '702 E. Peach',
    address: '',
    summary: 'Neighbors meet at 702 E. Peach to plan the gathering.',
    body: 'Meet at 702 E. Peach. [RSVP](https://partiful.com/e/potluck)',
    category: 'committee',
    externalUrl: 'https://partiful.com/e/potluck',
    topics: ['community', 'not-a-topic'],
    confidence: 'high',
    hasExplicitDateTime: true,
    ...overrides,
  };
}

function classify(events, extra = {}) {
  return classifyExtractedEvents(
    { events },
    {
      sourceText: SOURCE,
      archiveUrl: ARCHIVE,
      newsSlug: NEWS,
      existing: [],
      now: NOW,
      ...extra,
    },
  );
}

test('no events creates nothing', () => {
  const result = classify([]);
  assert.deepEqual(result.create, []);
  assert.deepEqual(result.skipped, []);
});

test('one explicit event becomes a published file linked to the news stub', () => {
  const result = classify([item()]);
  assert.equal(result.create.length, 1);
  assert.equal(result.skipped.length, 0);
  const event = result.create[0];
  assert.equal(event.rel, 'src/content/events/2026-12-01-planning-meeting.md');
  assert.equal(event.sourceUrl, ARCHIVE);
  const data = yaml.load(event.content.match(/^---\n([\s\S]*?)\n---/)[1]);
  assert.equal(data.draft, undefined);
  assert.equal(data.featured, false);
  assert.equal(data.startDate, '2026-12-01T16:30:00');
  assert.equal(data.endDate, '2026-12-01T18:00:00');
  assert.match(event.content, /^startDate: '2026-12-01T16:30:00'$/m);
  assert.deepEqual(data.newsSlugs, [NEWS]);
  assert.deepEqual(data.topics, ['community']);
  assert.equal(data.externalUrl, 'https://partiful.com/e/potluck');
});

test('several events in one campaign each get a file', () => {
  const result = classify([
    item(),
    item({
      title: 'Evening walk',
      start: '2026-12-02T18:00:00',
      end: '',
      category: 'tour',
    }),
  ]);
  assert.deepEqual(
    result.create.map((event) => event.rel),
    [
      'src/content/events/2026-12-01-planning-meeting.md',
      'src/content/events/2026-12-02-evening-walk.md',
    ],
  );
});

test('a gathering without a stated time is skipped', () => {
  const result = classify([item({ start: '2026-12-01', hasExplicitDateTime: false })]);
  assert.equal(result.create.length, 0);
  assert.equal(result.skipped[0].reason, 'low-confidence');

  const noClock = classifyExtractedEvents(
    { events: [item()] },
    {
      sourceText: 'Meet at 702 E. Peach sometime next month.',
      archiveUrl: ARCHIVE,
      newsSlug: NEWS,
      existing: [],
      now: NOW,
    },
  );
  assert.equal(noClock.create.length, 0);
  assert.equal(noClock.skipped[0].reason, 'missing-time');
});

test('an event that matches an existing file is not created again', () => {
  const result = classify([item()], {
    existing: [{ slug: 'other', title: 'Planning meeting', startDate: '2026-12-01', newsSlugs: [] }],
  });
  assert.equal(result.create.length, 0);
  assert.equal(result.skipped[0].reason, 'duplicate');
});

test('malformed model output creates no event', async () => {
  const broken = await extractCampaignEvents({
    newsletterText: SOURCE,
    archiveUrl: ARCHIVE,
    newsSlug: NEWS,
    now: NOW,
    apiKey: 'test',
    complete: async () => 'not json',
  });
  assert.deepEqual(broken.create, []);
  assert.equal(broken.skipped[0].reason, 'malformed-output');

  const shape = classifyExtractedEvents('nope', {
    sourceText: SOURCE,
    archiveUrl: ARCHIVE,
    newsSlug: NEWS,
    existing: [],
    now: NOW,
  });
  assert.equal(shape.create.length, 0);
  assert.equal(shape.skipped[0].reason, 'malformed-output');
});

test('a past event is skipped', () => {
  const result = classify([item({ start: '2020-01-02T16:30:00', end: '2020-01-02T18:00:00' })]);
  assert.equal(result.create.length, 0);
  assert.equal(result.skipped[0].reason, 'past');
});
