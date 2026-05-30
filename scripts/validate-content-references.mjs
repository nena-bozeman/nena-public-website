#!/usr/bin/env node
/**
 * Validate entity relation frontmatter values against real collection slugs.
 *
 * Usage: node scripts/validate-content-references.mjs
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const TOPIC_VALUES = [
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
];

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const CONTENT = join(ROOT, 'src/content');

function listSlugs(collection) {
  const dir = join(CONTENT, collection);
  if (!existsSync(dir)) return new Set();
  return new Set(
    readdirSync(dir)
      .filter((f) => f.endsWith('.md'))
      .map((f) => f.replace(/\.md$/, '')),
  );
}

function parseFrontmatter(filePath) {
  const raw = readFileSync(filePath, 'utf8');
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return null;
  return yaml.load(match[1]);
}

function walkMd(dir) {
  const files = [];
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (name.endsWith('.md')) files.push(path);
  }
  return files;
}

const slugSets = {
  news: listSlugs('news'),
  events: listSlugs('events'),
  development: listSlugs('development'),
  history: listSlugs('history'),
  meetings: listSlugs('meetings'),
  places: listSlugs('places'),
  objectives: listSlugs('objectives'),
};

const topicSet = new Set(TOPIC_VALUES);

/** @type {{ file: string, field: string, value: string }[]} */
const errors = [];

function check(file, field, values, targetCollection) {
  const set = slugSets[targetCollection];
  for (const value of values ?? []) {
    if (!value) continue;
    if (!set.has(value)) {
      errors.push({ file, field, value: `${value} (missing in ${targetCollection})` });
    }
  }
}

function checkTopics(file, topics) {
  for (const topic of topics ?? []) {
    if (!topicSet.has(topic)) {
      errors.push({ file, field: 'topics', value: `${topic} (not in TOPIC_VALUES)` });
    }
  }
}

function checkOptional(file, field, value, targetCollection) {
  if (!value) return;
  const set = slugSets[targetCollection];
  if (!set.has(value)) {
    errors.push({ file, field, value: `${value} (missing in ${targetCollection})` });
  }
}

function validateNews(file, data) {
  checkTopics(file, data.topics);
  check(file, 'developments', data.developments, 'development');
  check(file, 'places', data.places, 'places');
  check(file, 'meetings', data.meetings, 'meetings');
  check(file, 'events', data.events, 'events');
}

function validateEvents(file, data) {
  checkTopics(file, data.topics);
  checkOptional(file, 'meetingSlug', data.meetingSlug, 'meetings');
  check(file, 'newsSlugs', data.newsSlugs, 'news');
}

function validateMeetings(file, data) {
  checkTopics(file, data.topics);
  checkOptional(file, 'eventSlug', data.eventSlug, 'events');
  check(file, 'newsSlugs', data.newsSlugs, 'news');
}

function validateDevelopment(file, data) {
  checkTopics(file, data.topics);
  check(file, 'newsSlugs', data.newsSlugs, 'news');
}

function validateHistory(file, data) {
  checkTopics(file, data.topics);
  checkOptional(file, 'placeSlug', data.placeSlug, 'places');
}

function validatePlaces(file, data) {
  checkTopics(file, data.topics);
  checkOptional(file, 'historySlug', data.historySlug, 'history');
}

function validateObjectives(file, data) {
  checkTopics(file, data.topics);
  if (data.newsTags) {
    errors.push({ file, field: 'newsTags', value: 'deprecated — use topics' });
  }
}

const validators = {
  news: validateNews,
  events: validateEvents,
  meetings: validateMeetings,
  development: validateDevelopment,
  history: validateHistory,
  places: validatePlaces,
  objectives: validateObjectives,
};

for (const [collection, validate] of Object.entries(validators)) {
  const dir = join(CONTENT, collection);
  if (!existsSync(dir)) continue;
  for (const file of walkMd(dir)) {
    const data = parseFrontmatter(file);
    if (!data) continue;
    validate(file.replace(ROOT + '/', ''), data);
  }
}

if (errors.length > 0) {
  console.error('Content reference validation failed:\n');
  for (const e of errors) {
    console.error(`  ${e.file}: ${e.field} → ${e.value}`);
  }
  process.exit(1);
}

console.log('Content references OK.');
