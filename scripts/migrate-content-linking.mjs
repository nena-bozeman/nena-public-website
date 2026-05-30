#!/usr/bin/env node
/**
 * One-time content migration: newsTags→topics, split news tags into topics/tags,
 * add placeType to businesses, backfill meeting/event links.
 *
 * Usage: node scripts/migrate-content-linking.mjs
 */

import { readFileSync, writeFileSync, readdirSync, renameSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CONTENT = join(ROOT, 'src/content');

const TOPIC_VALUES = new Set([
  'newsletter',
  'meeting',
  'bozeman-udc',
  'affordable-housing',
  'parade-of-sheds',
  'visionne',
  'trees',
  'trails-pocket-parks',
  'traffic-calming',
  'nena-survey',
  'safe-quiet-rail-crossings',
  'environment',
  'volunteer',
  'community',
  'historic-preservation',
  'parking',
]);

const TAG_TO_TOPIC = {
  meetings: 'meeting',
  meeting: 'meeting',
};

function splitFrontmatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) return null;
  return { fm: match[1], body: match[2] };
}

function parseFm(fmText) {
  return yaml.load(fmText) ?? {};
}

function stringifyFm(data) {
  return yaml.dump(data, { lineWidth: 120, noRefs: true }).trimEnd();
}

function writeMd(path, data, body) {
  const fm = stringifyFm(data);
  writeFileSync(path, `---\n${fm}\n---\n${body}`, 'utf8');
}

function migrateTagsToTopics(tags) {
  const topics = [];
  const remaining = [];
  for (const tag of tags ?? []) {
    const normalized = String(tag).trim();
    if (!normalized) continue;
    const mapped = TAG_TO_TOPIC[normalized] ?? normalized;
    if (TOPIC_VALUES.has(mapped)) {
      if (!topics.includes(mapped)) topics.push(mapped);
    } else {
      remaining.push(normalized);
    }
  }
  return { topics, tags: remaining };
}

function migrateObjectives() {
  const dir = join(CONTENT, 'objectives');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    const path = join(dir, file);
    const parts = splitFrontmatter(readFileSync(path, 'utf8'));
    if (!parts) continue;
    const data = parseFm(parts.fm);
    if (data.newsTags) {
      data.topics = [...(data.newsTags ?? [])];
      delete data.newsTags;
      writeMd(path, data, parts.body);
      console.log(`objectives/${file}: newsTags → topics`);
    } else if (!data.topics) {
      data.topics = [];
      writeMd(path, data, parts.body);
    }
  }
}

function migrateNews() {
  const dir = join(CONTENT, 'news');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    const path = join(dir, file);
    const parts = splitFrontmatter(readFileSync(path, 'utf8'));
    if (!parts) continue;
    const data = parseFm(parts.fm);
    const existingTopics = data.topics ?? [];
    const { topics, tags } = migrateTagsToTopics(data.tags ?? []);
    data.topics = [...new Set([...existingTopics, ...topics])];
    data.tags = tags;
    writeMd(path, data, parts.body);
  }
  console.log('news: split tags → topics + tags');
}

function migrateDevelopment() {
  const dir = join(CONTENT, 'development');
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    const path = join(dir, file);
    const parts = splitFrontmatter(readFileSync(path, 'utf8'));
    if (!parts) continue;
    const data = parseFm(parts.fm);
    if (data.tags) {
      const { topics } = migrateTagsToTopics(data.tags);
      if (topics.length > 0) {
        data.topics = [...new Set([...(data.topics ?? []), ...topics])];
      }
      delete data.tags;
    }
    if (!data.topics) data.topics = [];
    if (!data.newsSlugs) data.newsSlugs = [];
    writeMd(path, data, parts.body);
  }
  console.log('development: removed tags, added topics/newsSlugs defaults');
}

function renameBusinessesToPlaces() {
  const from = join(CONTENT, 'businesses');
  const to = join(CONTENT, 'places');
  if (existsSync(from) && !existsSync(to)) {
    renameSync(from, to);
    console.log('Renamed src/content/businesses → places');
  }
  const dir = existsSync(to) ? to : from;
  if (!existsSync(dir)) return;
  for (const file of readdirSync(dir).filter((f) => f.endsWith('.md'))) {
    const path = join(dir, file);
    const parts = splitFrontmatter(readFileSync(path, 'utf8'));
    if (!parts) continue;
    const data = parseFm(parts.fm);
    if (!data.placeType) data.placeType = 'business';
    if (!data.topics) data.topics = [];
    writeMd(path, data, parts.body);
  }
  console.log('places: added placeType=business');
}

function seedParks() {
  const dir = join(CONTENT, 'places');
  if (!existsSync(dir)) return;

  const beallPark = join(dir, 'beall-park.md');
  if (!existsSync(beallPark)) {
    writeFileSync(
      beallPark,
      `---
name: Beall Park
placeType: park
address: "415 N Bozeman Ave, Bozeman, MT 59715"
lat: 45.689
lng: -111.032
historySlug: 1902-beall-park
topics:
  - trails-pocket-parks
status: current
---

Beall Park is the heart of the Northeast Neighborhood — a public gathering place with playgrounds, sports fields, and the [Beall Park Community Center](/history/1987-beall-park-community-center-added-to-the-national-register-of-historic-places). Read the [full history](/history/1902-beall-park) of how the park was established.
`,
      'utf8',
    );
    console.log('Seeded places/beall-park.md');
  }

  const pocketPark = join(dir, 'north-church-pocket-park.md');
  if (!existsSync(pocketPark)) {
    writeFileSync(
      pocketPark,
      `---
name: North Church Pocket Park
placeType: park
address: "North Church Street, Bozeman, MT"
topics:
  - trails-pocket-parks
status: current
---

A neighborhood pocket park discussed in [2021 news coverage](/news/2021-12-09-north-church-pocket-park) as a potential gathering space near North Church Street.
`,
      'utf8',
    );
    console.log('Seeded places/north-church-pocket-park.md');
  }

  const historyBeall = join(CONTENT, 'history/1902-beall-park.md');
  if (existsSync(historyBeall)) {
    const parts = splitFrontmatter(readFileSync(historyBeall, 'utf8'));
    if (parts) {
      const data = parseFm(parts.fm);
      data.placeSlug = 'beall-park';
      if (!data.topics) data.topics = ['trails-pocket-parks'];
      writeMd(historyBeall, data, parts.body);
      console.log('history/1902-beall-park.md: added placeSlug');
    }
  }
}

function backfillMeetingsEvents() {
  const meetingPath = join(CONTENT, 'meetings/2025-fall.md');
  if (existsSync(meetingPath)) {
    const parts = splitFrontmatter(readFileSync(meetingPath, 'utf8'));
    if (parts) {
      const data = parseFm(parts.fm);
      data.topics = [...new Set([...(data.topics ?? []), 'meeting'])];
      data.newsSlugs = [
        ...new Set([
          ...(data.newsSlugs ?? []),
          '2025-11-18-nena-fall-meeting-minutes-and-udc',
          '2025-11-04-nena-fall-meeting-potluck-november-5',
        ]),
      ];
      writeMd(meetingPath, data, parts.body);
      console.log('meetings/2025-fall.md: backfilled newsSlugs');
    }
  }

  const eventPath = join(CONTENT, 'events/2026-04-13-nena-spring-meeting-potluck.md');
  if (existsSync(eventPath)) {
    const parts = splitFrontmatter(readFileSync(eventPath, 'utf8'));
    if (parts) {
      const data = parseFm(parts.fm);
      data.topics = [...new Set([...(data.topics ?? []), 'meeting'])];
      data.newsSlugs = [
        ...new Set([
          ...(data.newsSlugs ?? []),
          '2026-04-09-nena-spring-meeting-potluck-april-13',
          '2026-04-13-nena-spring-meeting-notes',
        ]),
      ];
      writeMd(eventPath, data, parts.body);
      console.log('events/2026-04-13-nena-spring-meeting-potluck.md: backfilled');
    }
  }

  const paradeEvent = join(CONTENT, 'events/2025-10-19-parade-of-sheds.md');
  if (existsSync(paradeEvent)) {
    const parts = splitFrontmatter(readFileSync(paradeEvent, 'utf8'));
    if (parts) {
      const data = parseFm(parts.fm);
      data.topics = [...new Set([...(data.topics ?? []), 'parade-of-sheds'])];
      writeMd(paradeEvent, data, parts.body);
    }
  }

  const potluckEvent = join(CONTENT, 'events/2026-01-18-nena-potluck.md');
  if (existsSync(potluckEvent)) {
    const parts = splitFrontmatter(readFileSync(potluckEvent, 'utf8'));
    if (parts) {
      const data = parseFm(parts.fm);
      data.topics = [...new Set([...(data.topics ?? []), 'meeting'])];
      writeMd(potluckEvent, data, parts.body);
    }
  }
}

function backfillNewsTopics() {
  const newsUpdates = {
    '2025-11-18-nena-fall-meeting-minutes-and-udc.md': {
      topics: ['meeting', 'bozeman-udc'],
      tags: ['planning'],
    },
    '2026-04-09-nena-spring-meeting-potluck-april-13.md': {
      topics: ['meeting', 'newsletter'],
      tags: [],
    },
    '2026-04-13-nena-spring-meeting-notes.md': { topics: ['meeting'], tags: [] },
    '2026-02-20-community-meeting-recap.md': { topics: ['meeting', 'community'], tags: [] },
    '2026-03-15-spring-newsletter.md': { topics: ['newsletter', 'community'], tags: [] },
    '2025-10-10-idaho-pole-superfund-five-year-review.md': { topics: ['environment'], tags: [] },
    '2025-08-18-knock-out-burdock-blitz.md': { topics: ['volunteer'], tags: ['burdock-blitz'] },
    '2025-08-22-burdock-blitz-weekend-reminder.md': { topics: ['volunteer'], tags: ['burdock-blitz'] },
  };

  for (const [file, update] of Object.entries(newsUpdates)) {
    const path = join(CONTENT, 'news', file);
    if (!existsSync(path)) continue;
    const parts = splitFrontmatter(readFileSync(path, 'utf8'));
    if (!parts) continue;
    const data = parseFm(parts.fm);
    data.topics = [...new Set([...(data.topics ?? []), ...update.topics])];
    data.tags = update.tags;
    writeMd(path, data, parts.body);
  }
  console.log('news: backfilled specific topic assignments');
}

migrateObjectives();
migrateNews();
migrateDevelopment();
renameBusinessesToPlaces();
seedParks();
backfillMeetingsEvents();
backfillNewsTopics();

console.log('Migration complete.');
