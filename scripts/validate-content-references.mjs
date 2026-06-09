#!/usr/bin/env node
/**
 * Validate entity relation frontmatter values against real collection slugs.
 * When `dist/` exists (or --require-dist), also scan built HTML for unexpanded
 * Craft `{{ url:site }}` placeholders that should be replaced at build time.
 *
 * Usage: node scripts/validate-content-references.mjs [--require-dist] [--dir dist]
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { containsCraftSitePlaceholder } from '../src/utils/site-base.mjs';

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
const DEFAULT_DIST = join(ROOT, 'dist');

function parseArgs(argv) {
  let distDir = DEFAULT_DIST;
  let requireDist = false;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--require-dist') {
      requireDist = true;
    } else if (argv[i] === '--dir' && argv[i + 1]) {
      distDir = join(ROOT, argv[++i]);
    }
  }
  return { distDir, requireDist };
}

const { distDir, requireDist } = parseArgs(process.argv.slice(2));

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

/** Frontmatter date-only fields must be quoted YAML strings ('YYYY-MM-DD').
 *  Unquoted dates parse as Date objects and break Decap CMS list sorting.
 *  Event startDate/endDate are datetime — not listed here. */
const DATE_ONLY_FIELDS_BY_COLLECTION = {
  news: ['date'],
  meetings: ['meetingDate'],
  development: ['submittedDate'],
};

const DATE_ONLY_RAW = /^'(\d{4}-\d{2}-\d{2})'\s*$/;

/** Event datetimes must be quoted strings so Decap keeps them out of the Date sort group. */
const DATETIME_FIELDS_BY_COLLECTION = {
  events: ['startDate', 'endDate'],
};
const DATETIME_RAW =
  /^'(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z)?)'\s*$/;

/** @type {{ file: string, field: string, value: string }[]} */
const errors = [];

function checkDateOnlyFields(filePath, collection) {
  const fields = DATE_ONLY_FIELDS_BY_COLLECTION[collection];
  if (!fields) return;
  const raw = readFileSync(filePath, 'utf8');
  const rel = filePath.replace(ROOT + '/', '');
  for (const field of fields) {
    const match = raw.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'));
    if (!match) continue;
    const value = match[1].trim();
    if (!DATE_ONLY_RAW.test(value)) {
      errors.push({
        file: rel,
        field,
        value: `must be quoted 'YYYY-MM-DD' (got ${value})`,
      });
    }
  }
}

function checkDatetimeFields(filePath, collection) {
  const fields = DATETIME_FIELDS_BY_COLLECTION[collection];
  if (!fields) return;
  const raw = readFileSync(filePath, 'utf8');
  const rel = filePath.replace(ROOT + '/', '');
  for (const field of fields) {
    const match = raw.match(new RegExp(`^${field}:\\s*(.+)$`, 'm'));
    if (!match) continue;
    const value = match[1].trim();
    if (!DATETIME_RAW.test(value)) {
      errors.push({
        file: rel,
        field,
        value: `must be quoted datetime string (got ${value})`,
      });
    }
  }
}

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

const OUR_WORK_OBJECTIVE_SECTIONS = new Set([
  'neighborhood-communication',
  'neighborhood-advocacy',
]);

function validateObjectives(file, data) {
  checkTopics(file, data.topics);
  if (data.newsTags) {
    errors.push({ file, field: 'newsTags', value: 'deprecated — use topics' });
  }
  if (data.section && !OUR_WORK_OBJECTIVE_SECTIONS.has(data.section)) {
    errors.push({ file, field: 'section', value: data.section, message: 'unknown Our Work section' });
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
    const rel = file.replace(ROOT + '/', '');
    validate(rel, data);
    checkDateOnlyFields(file, collection);
    checkDatetimeFields(file, collection);
  }
}

/** @param {string} dir */
function walkHtmlFiles(dir, out = []) {
  for (const name of readdirSync(dir)) {
    if (name === '.' || name === '..') continue;
    const full = join(dir, name);
    const st = statSync(full);
    if (st.isDirectory()) walkHtmlFiles(full, out);
    else if (name.endsWith('.html')) out.push(full);
  }
  return out;
}

function checkBuiltPagesForCraftPlaceholders() {
  if (!existsSync(distDir)) {
    if (requireDist) {
      errors.push({
        file: relative(ROOT, distDir) || 'dist',
        field: 'build output',
        value: 'missing — run pnpm run build before validating final pages',
      });
    }
    return;
  }

  const htmlFiles = walkHtmlFiles(distDir);
  for (const abs of htmlFiles) {
    const rel = relative(distDir, abs).split(sep).join('/');
    const html = readFileSync(abs, 'utf8');
    if (containsCraftSitePlaceholder(html)) {
      errors.push({
        file: rel,
        field: 'html',
        value: 'unexpanded Craft {{ url:site }} placeholder in built page',
      });
    }
  }
}

checkBuiltPagesForCraftPlaceholders();

let builtHtmlCount = 0;
if (existsSync(distDir)) {
  builtHtmlCount = walkHtmlFiles(distDir).length;
}

if (errors.length > 0) {
  console.error('Content reference validation failed:\n');
  for (const e of errors) {
    console.error(`  ${e.file}: ${e.field} → ${e.value}`);
  }
  process.exit(1);
}

const distNote =
  requireDist && builtHtmlCount > 0 ? ` and ${builtHtmlCount} built HTML page(s)` : '';
console.log(`Content references OK${distNote}.`);
