#!/usr/bin/env node
/**
 * Run `rss-to-notes --write` against a copy of the default-branch content, then
 * commit only new draft news stubs onto the automation branch.
 *
 * The Mailchimp feed is data: this script never evaluates titles or HTML.
 * It does not push unless `--push` is set, and it does not call `gh`.
 * `--dry-run` never commits or pushes, even if `--push` is also set.
 * The workflow opens or updates the review pull request.
 *
 * Usage:
 *   node scripts/rss-stubs-branch.mjs \
 *     --base-ref origin/main \
 *     --branch-ref origin/automation/mailchimp-rss-stubs \
 *     --open-pr true \
 *     --push \
 *     --result-file /tmp/rss-stubs.json \
 *     --pr-body-file /tmp/rss-stubs-pr-body.md
 */

import { execFileSync } from 'node:child_process';
import {
  appendFileSync,
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import yaml from 'js-yaml';
import { resolveGeminiModel } from './lib/gemini-summary.mjs';
import { extractCampaignEvents } from './lib/mailchimp-campaign-events.mjs';
import {
  enrichDraftMarkdown,
  GEMINI_API_KEY_ENV,
  readStubFields,
  renderDraft,
  shouldRequestSummary,
} from './lib/mailchimp-campaign-summary.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT_REPO = join(__dirname, '..');

export const AUTOMATION_BRANCH = 'automation/mailchimp-rss-stubs';
export const COMMIT_SUBJECT = 'Add Mailchimp campaign draft stubs';
export const BOT_NAME = 'github-actions[bot]';
export const BOT_EMAIL = '41898282+github-actions[bot]@users.noreply.github.com';

const NEWS_PREFIX = 'src/content/news/';
const STUB_PATH_RE = /^src\/content\/news\/\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.md$/;
const ARCHIVE_URL_RE = /^https:\/\/mailchi\.mp\/[A-Za-z0-9]+\/[A-Za-z0-9-]+$/;
const STUB_FRONTMATTER_KEYS = new Set([
  'title',
  'date',
  'summary',
  'featured',
  'draft',
  'tags',
  'topics',
  'mailchimpArchiveUrl',
  'events',
]);
const BOT_GIT_CONFIG = [
  '-c',
  `user.name=${BOT_NAME}`,
  '-c',
  `user.email=${BOT_EMAIL}`,
  '-c',
  'commit.gpgsign=false',
];

/**
 * @param {string} repo
 * @param {string[]} args
 * @param {{ env?: NodeJS.ProcessEnv, input?: string }} [opts]
 */
function git(repo, args, opts = {}) {
  return execFileSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    input: opts.input,
    env: { ...process.env, ...opts.env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

/**
 * @param {string} repo
 * @param {string} branchRef
 * @param {string} rel
 * @returns {string | null}
 */
function existingBranchFile(repo, branchRef, rel) {
  if (!refExists(repo, branchRef)) return null;
  try {
    return git(repo, ['show', `${branchRef}:${rel}`]);
  } catch {
    return null;
  }
}

/**
 * Keep a file already on the automation branch. Summarize only a new bare stub.
 * An existing file is not rewritten, so a human edit stays put.
 *
 * @param {string} repo
 * @param {string} branchRef
 * @param {{ rel: string, content: string }[]} stubs
 * @param {string} apiKey
 */
async function prepareStubContents(repo, baseRef, branchRef, stubs, apiKey, htmlByCampaignId) {
  /** @type {{ rel: string, content: string, summarized: boolean, eventFiles: { rel: string, content: string, title: string, sourceUrl: string, slug: string }[] }[]} */
  const prepared = [];
  /** @type {{ title: string, reason: string, sourceUrl: string }[]} */
  const skippedEvents = [];
  const knownEvents = existingEventRecords(repo, branchRef);
  for (const stub of stubs) {
    const existing = existingBranchFile(repo, branchRef, stub.rel);
    const deleted = deletedOnBranchRef(repo, baseRef, branchRef, stub.rel);
    if (!shouldRequestSummary({ existing, deleted })) {
      prepared.push({
        ...stub,
        content: existing ?? stub.content,
        summarized: false,
        eventFiles: [],
        fallbackReason: existing
          ? 'already on the review branch'
          : 'removed from the open review pull request',
      });
      continue;
    }
    const campaignId = (readStubFields(stub.content)?.archiveUrl.match(/mailchi\.mp\/([^/?#]+)/i)?.[1] ?? '').toLowerCase();
    const enriched = await enrichDraftMarkdown(stub.content, {
      apiKey,
      campaignHtml: htmlByCampaignId.get(campaignId) ?? '',
    });
    let content = stub.content;
    let summarized = false;
    if (enriched.summarized) {
      try {
        assertDraftStub(stub.rel, enriched.markdown, new Set(), { allowBody: true });
        content = enriched.markdown;
        summarized = true;
      } catch (error) {
        console.error(
          `rss-stubs-branch: keeping bare stub for ${stub.rel} (${error instanceof Error ? error.message : error})`,
        );
      }
    } else if (apiKey.trim()) {
      console.error(`rss-stubs-branch: bare stub for ${stub.rel} (${enriched.reason})`);
    }
    const fallbackReason = summarized
      ? ''
      : enriched.summarized
        ? 'summary failed validation'
        : enriched.reason;
    /** @type {{ rel: string, content: string, title: string, sourceUrl: string, slug: string }[]} */
    let eventFiles = [];
    if (enriched.newsletterText && apiKey.trim()) {
      const newsSlug = stub.rel.replace(/^src\/content\/news\//, '').replace(/\.md$/, '');
      const extracted = await extractCampaignEvents({
        newsletterText: enriched.newsletterText,
        archiveUrl: enriched.fields?.archiveUrl ?? '',
        newsSlug,
        existing: knownEvents,
        apiKey,
      });
      eventFiles = extracted.create;
      for (const skip of extracted.skipped) {
        skippedEvents.push({ ...skip, sourceUrl: enriched.fields?.archiveUrl ?? '' });
      }
      if (eventFiles.length > 0) {
        const fields = readStubFields(content);
        const data = yaml.load(content.match(/^---\r?\n([\s\S]*?)\r?\n---/)[1]);
        const linked = renderDraft({
          title: fields.title,
          date: fields.date,
          archiveUrl: fields.archiveUrl,
          summary: String(data.summary ?? ''),
          body: fields.body.trim(),
          eventSlugs: eventFiles.map((eventFile) => eventFile.slug),
        });
        try {
          assertDraftStub(stub.rel, linked, new Set(), {
            allowBody: summarized,
            eventSlugs: eventFiles.map((eventFile) => eventFile.slug),
          });
          content = linked;
        } catch (error) {
          console.error(
            `rss-stubs-branch: not linking events for ${stub.rel} (${error instanceof Error ? error.message : error})`,
          );
          eventFiles = [];
        }
      }
    }
    prepared.push({ ...stub, content, summarized, eventFiles, fallbackReason });
  }
  return { prepared, skippedEvents };
}

function existingEventRecords(repo, branchRef) {
  /** @type {{ slug: string, title: string, startDate: string, newsSlugs: string[] }[]} */
  const records = [];
  const dir = join(repo, 'src/content/events');
  if (existsSync(dir)) {
    for (const name of readdirSync(dir)) {
      if (!name.endsWith('.md')) continue;
      records.push(eventRecord(name.replace(/\.md$/, ''), readFileSync(join(dir, name), 'utf8')));
    }
  }
  if (!refExists(repo, branchRef)) return records;
  let names = '';
  try {
    names = git(repo, ['ls-tree', '-r', '--name-only', branchRef, 'src/content/events']);
  } catch {
    return records;
  }
  for (const rel of names.trim().split('\n').filter((name) => name.endsWith('.md'))) {
    const slug = rel.replace(/^src\/content\/events\//, '').replace(/\.md$/, '');
    if (records.some((record) => record.slug === slug)) continue;
    try {
      records.push(eventRecord(slug, git(repo, ['show', `${branchRef}:${rel}`])));
    } catch {
      // Skip a path that is not a blob.
    }
  }
  return records;
}

function eventRecord(slug, content) {
  const match = String(content).match(/^---\r?\n([\s\S]*?)\r?\n---/);
  const data = match ? yaml.load(match[1]) : {};
  const start = data && typeof data.startDate === 'string' ? data.startDate : '';
  return {
    slug,
    title: data && typeof data.title === 'string' ? data.title : '',
    startDate: start,
    newsSlugs: data && Array.isArray(data.newsSlugs) ? data.newsSlugs : [],
  };
}

function branchEventFiles(repo, baseRef, branchRef) {
  if (!refExists(repo, branchRef)) return [];
  let names = '';
  try {
    names = git(repo, [
      'diff',
      '--name-only',
      '--diff-filter=A',
      baseRef,
      branchRef,
      '--',
      'src/content/events',
    ]);
  } catch {
    return [];
  }
  /** @type {{ rel: string, content: string }[]} */
  const files = [];
  for (const rel of names.trim().split('\n').filter((name) => name.endsWith('.md'))) {
    try {
      files.push({ rel, content: git(repo, ['show', `${branchRef}:${rel}`]) });
    } catch {
      // Skip paths that are not blobs.
    }
  }
  return files;
}

function deletedOnBranchRef(repo, baseRef, branchRef, rel) {
  if (!refExists(repo, branchRef)) return false;
  const deleted = git(repo, [
    'log',
    '--diff-filter=D',
    '--name-only',
    '--format=',
    `${baseRef}..${branchRef}`,
    '--',
    rel,
  ]).trim();
  return deleted.length > 0;
}

function refExists(repo, ref) {
  try {
    git(repo, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} root
 * @returns {Map<string, Buffer>}
 */
function contentFiles(root) {
  /** @type {Map<string, Buffer>} */
  const files = new Map();
  const contentRoot = join(root, 'src/content');
  if (!existsSync(contentRoot)) return files;

  /** @param {string} dir */
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      const info = statSync(path);
      if (info.isDirectory()) {
        walk(path);
      } else if (info.isFile()) {
        const rel = relative(root, path).split('\\').join('/');
        files.set(rel, readFileSync(path));
      }
    }
  }

  walk(contentRoot);
  return files;
}

/**
 * New `src/content/news/*.md` files created by an import.
 * Modifications and deletions are errors so a bad run cannot replace content.
 *
 * @param {string} baseRoot
 * @param {string} importedRoot
 * @returns {{ rel: string, content: string }[]}
 */
export function findNewNewsStubs(baseRoot, importedRoot) {
  const base = contentFiles(baseRoot);
  const imported = contentFiles(importedRoot);
  /** @type {{ rel: string, content: string }[]} */
  const additions = [];

  for (const [rel, buf] of imported) {
    const before = base.get(rel);
    if (!before) {
      if (!rel.startsWith(NEWS_PREFIX)) {
        throw new Error(`Import created an unexpected path: ${rel}`);
      }
      additions.push({ rel, content: buf.toString('utf8') });
      continue;
    }
    if (!before.equals(buf)) {
      throw new Error(`Import modified existing content: ${rel}`);
    }
  }

  for (const rel of base.keys()) {
    if (!imported.has(rel)) {
      throw new Error(`Import removed existing content: ${rel}`);
    }
  }

  additions.sort((a, b) => a.rel.localeCompare(b.rel));
  return additions;
}

/**
 * @param {string} root
 * @returns {Set<string>}
 */
function knownCampaignIds(root) {
  /** @type {Set<string>} */
  const ids = new Set();
  for (const dir of ['news', 'events']) {
    const abs = join(root, 'src/content', dir);
    if (!existsSync(abs)) continue;
    for (const name of readdirSync(abs)) {
      if (!name.endsWith('.md')) continue;
      const text = readFileSync(join(abs, name), 'utf8');
      for (const match of text.matchAll(/mailchi\.mp\/([^/?#\s"'<>]+)/gi)) {
        ids.add(match[1].toLowerCase());
      }
    }
  }
  return ids;
}

/**
 * @param {string} rel
 * @param {string} content
 * @param {Set<string>} knownIds
 * @returns {string}
 */
export function assertDraftStub(rel, content, knownIds, options = {}) {
  if (!STUB_PATH_RE.test(rel)) {
    throw new Error(`Unexpected stub path: ${rel}`);
  }
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error(`${rel} is not a markdown stub`);
  const data = yaml.load(match[1]);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`${rel} frontmatter is not a mapping`);
  }
  for (const key of Object.keys(data)) {
    if (!STUB_FRONTMATTER_KEYS.has(key)) {
      throw new Error(`${rel} has unexpected frontmatter ${key}`);
    }
  }
  if (!options.allowBody && match[2].trim() !== '') throw new Error(`${rel} body is not empty`);
  if (data.draft !== true) throw new Error(`${rel} is not a draft`);
  if (data.featured !== false) throw new Error(`${rel} featured is not false`);
  if (!Array.isArray(data.topics) || data.topics.length !== 0) {
    throw new Error(`${rel} topics are not empty`);
  }
  if (!Array.isArray(data.tags) || data.tags.length !== 0) {
    throw new Error(`${rel} tags are not empty`);
  }
  if (data.events != null) {
    if (!Array.isArray(data.events) || data.events.some((slug) => typeof slug !== 'string' || !/^[a-z0-9-]+$/.test(slug))) {
      throw new Error(`${rel} events are not slugs`);
    }
    if (options.eventSlugs) {
      const allowed = new Set(options.eventSlugs);
      if (data.events.some((slug) => !allowed.has(slug))) {
        throw new Error(`${rel} links an event this run did not create`);
      }
    }
  }
  if (typeof data.mailchimpArchiveUrl !== 'string' || !ARCHIVE_URL_RE.test(data.mailchimpArchiveUrl)) {
    throw new Error(`${rel} archive URL is not a mailchi.mp link`);
  }
  const dateLine = match[1].match(/^date:\s*(.+)$/m);
  if (!dateLine || !/^'\d{4}-\d{2}-\d{2}'$/.test(dateLine[1].trim())) {
    throw new Error(`${rel} date is not a quoted YYYY-MM-DD`);
  }
  const id = data.mailchimpArchiveUrl.match(/mailchi\.mp\/([^/?#]+)/i)?.[1]?.toLowerCase();
  if (!id) throw new Error(`${rel} is missing a campaign id`);
  if (knownIds.has(id)) {
    throw new Error(`${rel} campaign ${id} is already in content`);
  }
  return id;
}

/**
 * @param {string} repo
 * @param {string} file
 */
function importIntoCopy(repo, file, descriptionsPath) {
  const tmp = mkdtempSync(join(tmpdir(), 'rss-stubs-import-'));
  const source = join(repo, 'src/content');
  if (!existsSync(source)) {
    rmSync(tmp, { recursive: true, force: true });
    throw new Error('missing src/content');
  }
  mkdirSync(join(tmp, 'src'), { recursive: true });
  cpSync(source, join(tmp, 'src/content'), { recursive: true });

  const args = [
    join(SCRIPT_REPO, 'scripts/rss-to-notes.mjs'),
    '--write',
    '--format',
    'json',
    '--descriptions-out',
    descriptionsPath,
  ];
  if (file) args.push('--file', file);

  try {
    execFileSync(process.execPath, args, {
      cwd: repo,
      encoding: 'utf8',
      env: { ...process.env, RSS_TO_NOTES_ROOT: tmp },
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch (error) {
    const stderr = error && typeof error === 'object' && 'stderr' in error ? String(error.stderr ?? '') : '';
    const stdout = error && typeof error === 'object' && 'stdout' in error ? String(error.stdout ?? '') : '';
    rmSync(tmp, { recursive: true, force: true });
    const detail = (stderr || stdout || (error instanceof Error ? error.message : String(error))).trim();
    throw new Error(`rss-to-notes failed:\n${detail}`);
  }

  return tmp;
}

/**
 * @param {string} repo
 */
function runContentChecks(repo) {
  if (process.env.RSS_STUBS_VALIDATE === 'fail') {
    throw new Error('content check failed');
  }
  if (!existsSync(join(repo, 'package.json'))) {
    console.log('rss-stubs-branch: no package.json in this checkout; skipping content checks');
    return;
  }
  execFileSync('pnpm', ['run', 'check'], {
    cwd: repo,
    stdio: 'inherit',
  });
}

/**
 * @param {string} repo
 * @param {string} baseRef
 * @param {string} branchRef
 */
function hasNonBotCommits(repo, baseRef, branchRef) {
  const log = git(repo, ['log', '--format=%ae%x1f%ce', `${baseRef}..${branchRef}`]).trim();
  if (!log) return false;
  for (const line of log.split('\n')) {
    const [author, committer] = line.split('\u001f');
    if (author !== BOT_EMAIL || committer !== BOT_EMAIL) return true;
  }
  return false;
}

/**
 * @param {string} repo
 * @param {string} baseRef
 * @param {{ rel: string, content: string }[]} stubs
 */
function treeWithStubs(repo, baseRef, stubs) {
  const dir = mkdtempSync(join(tmpdir(), 'rss-index-'));
  const index = join(dir, 'index');
  const env = { GIT_INDEX_FILE: index };
  try {
    git(repo, ['read-tree', baseRef], { env });
    for (const stub of stubs) {
      const hash = git(repo, ['hash-object', '-w', '--stdin'], {
        env,
        input: stub.content,
      }).trim();
      git(repo, ['update-index', '--add', '--cacheinfo', `100644,${hash},${stub.rel}`], { env });
    }
    return git(repo, ['write-tree'], { env }).trim();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * @param {string} repo
 * @param {string[]} paths
 */
function commitAddedPaths(repo, paths) {
  git(repo, ['add', '--', ...paths]);
  const cached = git(repo, ['diff', '--cached', '--name-status'])
    .trim()
    .split('\n')
    .filter(Boolean);
  if (cached.length !== paths.length) {
    throw new Error(`Refusing to commit unexpected staged changes:\n${cached.join('\n')}`);
  }
  for (const line of cached) {
    const [status, name] = line.split('\t');
    if (status !== 'A' || !paths.includes(name)) {
      throw new Error(`Refusing to commit ${line}`);
    }
  }
  const porcelain = git(repo, ['status', '--porcelain'])
    .trim()
    .split('\n')
    .filter(Boolean);
  for (const line of porcelain) {
    const status = line.slice(0, 2);
    const name = line.slice(3);
    if (!(status === 'A ' && paths.includes(name))) {
      throw new Error(`Work tree has unrelated changes: ${line}`);
    }
  }
  git(repo, [...BOT_GIT_CONFIG, 'commit', '-m', COMMIT_SUBJECT]);
}

/**
 * @param {string} repo
 * @param {string} path
 * @param {string} baseRef
 */
function deletedOnBranchSince(repo, path, baseRef) {
  const deleted = git(repo, [
    'log',
    '--diff-filter=D',
    '--name-only',
    '--format=',
    `${baseRef}..HEAD`,
    '--',
    path,
  ]).trim();
  return deleted.length > 0;
}

/**
 * @param {string} repo
 * @param {{
 *   beforeSha: string | null,
 *   createdBranch: boolean,
 *   branchName: string,
 *   startBranch: string,
 * }} state
 */
function rollback(repo, state) {
  let current = '';
  try {
    current = git(repo, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  } catch {
    current = '';
  }
  if (current === state.branchName) {
    try {
      git(repo, ['merge', '--abort']);
    } catch {
      // Not in a merge.
    }
    try {
      git(repo, ['reset', '--hard', state.beforeSha || 'HEAD']);
    } catch {
      // Branch may already point where we need it.
    }
    try {
      git(repo, ['clean', '-fd', '--', 'src/content/news', 'src/content/events']);
    } catch {
      // Nothing to clean.
    }
  }
  if (state.startBranch && state.startBranch !== 'HEAD') {
    try {
      current = git(repo, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
      if (current !== state.startBranch) git(repo, ['switch', state.startBranch]);
    } catch {
      // Leave the checkout where it is if switch fails.
    }
  }
  if (state.createdBranch) {
    try {
      git(repo, ['branch', '-D', state.branchName]);
    } catch {
      // Already deleted.
    }
  }
}

/**
 * @param {string} repo
 * @param {string} startBranch
 */
function formatEventWhen(start, end) {
  const startParts = wallClock(start);
  if (!startParts) return String(start ?? '');
  const endParts = wallClock(end);
  const time = endParts && endParts.date === startParts.date
    ? `${startParts.time}–${endParts.time}`
    : startParts.time;
  return `${startParts.date}, ${time}`;
}

function wallClock(value) {
  const match = String(value ?? '').match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (!match) return null;
  let hour = Number(match[2]);
  const suffix = hour >= 12 ? 'p.m.' : 'a.m.';
  hour = hour % 12 || 12;
  const time = match[3] === '00' ? `${hour} ${suffix}` : `${hour}:${match[3]} ${suffix}`;
  return { date: match[1], time };
}

function returnToStart(repo, startBranch) {
  if (!startBranch || startBranch === 'HEAD') return;
  const current = git(repo, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  if (current !== startBranch) git(repo, ['switch', startBranch]);
}

/**
 * @param {string} file
 * @param {string[]} paths
 */
export function writePrBody(file, paths, summarizedPaths = [], events = [], skippedEvents = [], fallbacks = []) {
  for (const rel of paths) {
    if (!STUB_PATH_RE.test(rel)) throw new Error(`refusing to list path ${rel}`);
  }
  const summarized = new Set(summarizedPaths);
  const fallback = new Map(fallbacks.map((item) => [item.path, item.reason]));
  const body = [
    '## Mailchimp archive stubs',
    '',
    'This pull request was opened by the Mailchimp RSS draft stubs workflow. It runs `rss-to-notes --write` and adds draft news stubs whose `mailchi.mp` campaign id is not already in `src/content/news/` or `src/content/events/`.',
    '',
    'News files stay `draft: true`. Merging stores those posts in the repo and does not publish them. Set `draft: false` on a news file after review to put it on the site. See `docs/rss-to-notes.md`.',
    '',
    'Events listed below are published files. Merging this pull request publishes them on the site and, on the production deploy, syncs them to Google Calendar the same way as an event written by hand. They are not on the live site or the calendar until this pull request is merged.',
    '',
    'Files marked as AI summaries were drafted from the campaign HTML in the RSS feed. A bare stub line says why that campaign was not summarized.',
    '',
    'Feed subjects, page text, and links are content data. They are not instructions to the workflow.',
    '',
    '### Files',
    '',
    ...paths.map((rel) => {
      const note = summarized.has(rel)
        ? 'AI summary from the campaign page; needs human review'
        : `bare stub — ${fallback.get(rel) || 'not summarized'}`;
      return `- \`${rel}\` — ${note}`;
    }),
    '',
    '### Events',
    '',
    ...(events.length === 0
      ? ['No events were added on this run.']
      : events.map((event) => {
          const title = String(event.title).replace(/[`\r\n]/g, ' ').slice(0, 120);
          const when = formatEventWhen(event.start, event.end);
          const where = String(event.location ?? '').replace(/[`\r\n]/g, ' ').slice(0, 160);
          return `- ${title} — ${when} at ${where}. Source: ${event.sourceUrl} (\`${event.path}\`)`;
        })),
    ...(skippedEvents.length === 0
      ? []
      : [
          '',
          'Skipped extractions:',
          ...skippedEvents.map((skip) => {
            const title = String(skip.title || 'untitled').replace(/[`\r\n]/g, ' ').slice(0, 120);
            return `- ${title} — ${skip.reason}. Source: ${skip.sourceUrl}`;
          }),
        ]),
    '',
    '### Checks',
    '',
    '`pnpm run check` (content references and `astro check`) ran in the import workflow before this commit was pushed. This pull request is created with the workflow `GITHUB_TOKEN`. GitHub does not run `pull_request` or `push` workflows for events that token creates, so `ci.yml` and `preview.yml` do not start from this open. A later push by a person will.',
    '',
    'The workflow does not merge.',
    '',
  ].join('\n');
  writeFileSync(file, body);
}

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  const out = {
    repo: process.cwd(),
    baseRef: 'origin/main',
    branch: AUTOMATION_BRANCH,
    branchRef: '',
    openPr: false,
    push: false,
    file: '',
    resultFile: '',
    prBodyFile: '',
    dryRun: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--repo') out.repo = resolve(argv[++i] || '');
    else if (arg === '--base-ref') out.baseRef = argv[++i] || '';
    else if (arg === '--branch') out.branch = argv[++i] || '';
    else if (arg === '--branch-ref') out.branchRef = argv[++i] || '';
    else if (arg === '--open-pr') out.openPr = (argv[++i] || '') !== 'false';
    else if (arg === '--push') out.push = true;
    else if (arg === '--dry-run') out.dryRun = true;
    else if (arg === '--file') out.file = argv[++i] || '';
    else if (arg === '--result-file') out.resultFile = argv[++i] || '';
    else if (arg === '--pr-body-file') out.prBodyFile = argv[++i] || '';
    else throw new Error(`unknown argument ${arg}`);
  }
  if (!out.branchRef) out.branchRef = out.branch;
  return out;
}

/**
 * @param {string} repo
 * @param {string} branchName
 * @param {boolean} force
 */
function pushBranch(repo, branchName, force) {
  const args = ['push'];
  if (force) args.push('--force-with-lease');
  else args.push('--set-upstream');
  args.push('origin', `${branchName}:${branchName}`);
  git(repo, args);
}

/**
 * Copy `src/content` from a git ref into a temp directory. The working tree
 * stays untouched, so a dry run can import against the default branch while
 * the checkout is the branch under test.
 *
 * @param {string} repo
 * @param {string} baseRef
 */
function contentSnapshot(repo, baseRef) {
  const root = mkdtempSync(join(tmpdir(), 'rss-stubs-base-'));
  let archive;
  try {
    archive = execFileSync('git', ['archive', baseRef, 'src/content'], { cwd: repo });
  } catch (error) {
    rmSync(root, { recursive: true, force: true });
    const detail = error && typeof error === 'object' && 'stderr' in error ? String(error.stderr ?? '') : '';
    throw new Error(`Could not read src/content from ${baseRef}.${detail ? ` ${detail.trim()}` : ''}`);
  }
  execFileSync('tar', ['-x', '-C', root], { input: archive });
  return root;
}

/**
 * @param {string} markdown
 */
function writeStepSummary(markdown) {
  if (!process.env.GITHUB_STEP_SUMMARY) return;
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, markdown);
}

/**
 * @param {{
 *   model: string,
 *   prepared: { rel: string, content: string, summarized: boolean, fallbackReason?: string, eventFiles?: { rel: string, title: string, start: string, end?: string, location: string, sourceUrl: string, content: string }[] }[],
 *   skippedEvents: { title: string, reason: string, sourceUrl: string }[],
 * }} report
 */
export function formatDryRunReport(report) {
  return formatImportSummary({ ...report, dryRun: true });
}

/**
 * @param {{
 *   model: string,
 *   dryRun?: boolean,
 *   prepared: { rel: string, content: string, summarized: boolean, fallbackReason?: string, eventFiles?: { rel: string, title: string, start: string, end?: string, location: string, sourceUrl: string, content: string }[] }[],
 *   skippedEvents: { title: string, reason: string, sourceUrl: string }[],
 * }} report
 */
export function formatImportSummary(report) {
  const dryRun = report.dryRun === true;
  /** @type {string[]} */
  const lines = [
    dryRun ? '## Mailchimp RSS dry run' : '## Mailchimp RSS import',
    '',
    `Model: \`${report.model}\``,
    '',
    dryRun
      ? 'This run did not commit, push, or open a pull request. `automation/mailchimp-rss-stubs` was not changed.'
      : 'Campaign summaries and extracted events from this run.',
    '',
  ];
  if (report.prepared.length === 0) {
    lines.push('No new campaign stubs.');
    lines.push('');
  }
  for (const stub of report.prepared) {
    lines.push(`### \`${stub.rel}\``);
    lines.push('');
    if (stub.summarized) {
      const fields = readStubFields(stub.content);
      const match = stub.content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
      const data = match ? yaml.load(match[1]) : {};
      const summary = data && typeof data.summary === 'string' ? data.summary : '';
      lines.push(summary);
      lines.push('');
      lines.push(fields?.body?.trim() || '');
    } else {
      lines.push(`Bare stub — ${stub.fallbackReason || 'not summarized'}`);
    }
    lines.push('');
    const events = stub.eventFiles ?? [];
    if (events.length === 0) {
      lines.push('No events extracted from this campaign.');
    } else {
      for (const eventFile of events) {
        const when = formatEventWhen(eventFile.start, eventFile.end);
        const where = String(eventFile.location ?? '').replace(/[`\r\n]/g, ' ');
        lines.push(`- ${eventFile.title} — ${when} at ${where}. Source: ${eventFile.sourceUrl} (\`${eventFile.rel}\`)`);
        lines.push('');
        lines.push(eventFile.content.trim());
        lines.push('');
      }
    }
    lines.push('');
  }
  if (report.skippedEvents.length > 0) {
    lines.push('### Skipped extractions');
    lines.push('');
    for (const skip of report.skippedEvents) {
      const title = String(skip.title || 'untitled').replace(/[`\r\n]/g, ' ');
      lines.push(`- ${title} — ${skip.reason}. Source: ${skip.sourceUrl}`);
    }
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}

/**
 * Import and summarize against `baseRef` content. Never switches branches,
 * commits, or pushes, including when `--push` is also set.
 *
 * @param {ReturnType<typeof parseArgs>} args
 */
export async function dryRunSummaries(args) {
  const { repo, baseRef, file } = args;
  if (!refExists(repo, baseRef)) {
    throw new Error(`Base ref not found: ${baseRef}`);
  }
  const model = resolveGeminiModel();
  console.error(`rss-stubs-branch: dry run, Gemini model ${model}`);
  const snapshot = contentSnapshot(repo, baseRef);
  const descriptionsPath = join(tmpdir(), `rss-descriptions-dry-${process.pid}-${Date.now()}.json`);
  try {
    const importedRoot = importIntoCopy(snapshot, file, descriptionsPath);
    /** @type {{ rel: string, content: string }[]} */
    let stubs;
    /** @type {Map<string, string>} */
    let htmlByCampaignId = new Map();
    try {
      stubs = findNewNewsStubs(snapshot, importedRoot);
      if (existsSync(descriptionsPath)) {
        const parsed = JSON.parse(readFileSync(descriptionsPath, 'utf8'));
        htmlByCampaignId = new Map(Object.entries(parsed));
      }
    } finally {
      rmSync(importedRoot, { recursive: true, force: true });
    }

    const knownIds = knownCampaignIds(snapshot);
    /** @type {Set<string>} */
    const seenIds = new Set();
    for (const stub of stubs) {
      const id = assertDraftStub(stub.rel, stub.content, knownIds);
      if (seenIds.has(id)) throw new Error(`Duplicate campaign id in import: ${id}`);
      seenIds.add(id);
      knownIds.add(id);
    }

    const { prepared, skippedEvents } = await prepareStubContents(
      snapshot,
      baseRef,
      'refs/dry-run/none',
      stubs,
      process.env[GEMINI_API_KEY_ENV] ?? '',
      htmlByCampaignId,
    );
    const report = formatDryRunReport({ model, prepared, skippedEvents });
    writeStepSummary(report);
    process.stdout.write(report);
    const createdEvents = prepared.flatMap((stub) => stub.eventFiles ?? []);
    return {
      result: 'dry-run',
      branch: '',
      files: prepared.map((stub) => stub.rel),
      summarized: prepared.filter((stub) => stub.summarized).map((stub) => stub.rel),
      events: createdEvents.map((eventFile) => ({
        path: eventFile.rel,
        title: eventFile.title,
        start: eventFile.start,
        end: eventFile.end,
        location: eventFile.location,
        sourceUrl: eventFile.sourceUrl,
      })),
      skippedEvents,
      fallbacks: prepared
        .filter((stub) => !stub.summarized && stub.fallbackReason)
        .map((stub) => ({ path: stub.rel, reason: stub.fallbackReason })),
    };
  } finally {
    rmSync(snapshot, { recursive: true, force: true });
    rmSync(descriptionsPath, { force: true });
  }
}

/**
 * @param {ReturnType<typeof parseArgs>} args
 */
export async function updateAutomationBranch(args) {
  const { repo, baseRef, branch, branchRef, openPr, push, file } = args;
  const status = git(repo, ['status', '--porcelain']).trim();
  if (status) {
    throw new Error(`Refusing to run with a dirty work tree:\n${status}`);
  }
  if (!refExists(repo, baseRef)) {
    throw new Error(`Base ref not found: ${baseRef}`);
  }
  const head = git(repo, ['rev-parse', 'HEAD']).trim();
  const baseSha = git(repo, ['rev-parse', baseRef]).trim();
  if (head !== baseSha) {
    throw new Error(`Checkout HEAD is not ${baseRef}. Refusing to import from another branch.`);
  }
  const model = resolveGeminiModel();
  console.error(`rss-stubs-branch: Gemini model ${model}`);

  const startBranch = git(repo, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  const descriptionsPath = join(tmpdir(), `rss-descriptions-${process.pid}.json`);
  const importedRoot = importIntoCopy(repo, file, descriptionsPath);
  /** @type {Map<string, string>} */
  let htmlByCampaignId = new Map();
  /** @type {{ rel: string, content: string }[]} */
  let stubs;
  try {
    stubs = findNewNewsStubs(repo, importedRoot);
    if (existsSync(descriptionsPath)) {
      const parsed = JSON.parse(readFileSync(descriptionsPath, 'utf8'));
      htmlByCampaignId = new Map(Object.entries(parsed));
    }
  } finally {
    rmSync(importedRoot, { recursive: true, force: true });
    rmSync(descriptionsPath, { force: true });
  }

  const knownIds = knownCampaignIds(repo);
  /** @type {Set<string>} */
  const seenIds = new Set();
  for (const stub of stubs) {
    const id = assertDraftStub(stub.rel, stub.content, knownIds);
    if (seenIds.has(id)) throw new Error(`Duplicate campaign id in import: ${id}`);
    seenIds.add(id);
    knownIds.add(id);
  }

  const { prepared, skippedEvents } = await prepareStubContents(
    repo,
    baseRef,
    branchRef,
    stubs,
    process.env[GEMINI_API_KEY_ENV] ?? '',
    htmlByCampaignId,
  );
  const summarized = prepared.filter((stub) => stub.summarized).map((stub) => stub.rel);
  const createdEvents = prepared.flatMap((stub) => stub.eventFiles ?? []);
  const carriedEvents = branchEventFiles(repo, baseRef, branchRef).filter(
    (file) => !createdEvents.some((eventFile) => eventFile.rel === file.rel),
  );

  const branchExists = refExists(repo, branchRef);
  /** @type {'noop' | 'close-empty' | 'needs-pr' | 'committed'} */
  let result = 'noop';

  if (stubs.length === 0) {
    if (openPr && branchExists) {
      const diff = git(repo, ['diff', '--name-only', baseRef, branchRef]).trim();
      if (!diff) result = 'close-empty';
    }
    writeStepSummary(formatImportSummary({ model, prepared, skippedEvents, dryRun: false }));
    return {
      result,
      branch,
      files: /** @type {string[]} */ ([]),
      summarized: /** @type {string[]} */ ([]),
      events: /** @type {{ path: string, title: string, sourceUrl: string }[]} */ ([]),
      skippedEvents: /** @type {{ title: string, reason: string, sourceUrl: string }[]} */ ([]),
    };
  }

  if (openPr && !branchExists) {
    throw new Error(`An open pull request was reported, but ${branchRef} does not exist.`);
  }

  /** @type {{ beforeSha: string | null, createdBranch: boolean, branchName: string, startBranch: string }} */
  const state = {
    beforeSha: null,
    createdBranch: false,
    branchName: branch,
    startBranch,
  };

  try {
    if (openPr) {
      git(repo, ['switch', '-C', branch, branchRef]);
      state.beforeSha = git(repo, ['rev-parse', 'HEAD']).trim();
      try {
        git(repo, [...BOT_GIT_CONFIG, 'merge', '--no-edit', baseRef]);
      } catch (error) {
        const detail = error && typeof error === 'object' && 'stderr' in error ? String(error.stderr ?? '') : '';
        throw new Error(
          `Refusing to overwrite the open review branch: merging ${baseRef} conflicted.\n${detail.trim()}`,
        );
      }

      /** @type {string[]} */
      const added = [];
      for (const stub of stubs) {
        const dest = join(repo, stub.rel);
        if (existsSync(dest)) continue;
        if (deletedOnBranchSince(repo, stub.rel, baseRef)) continue;
        mkdirSync(dirname(dest), { recursive: true });
        const preparedStub = prepared.find((item) => item.rel === stub.rel) ?? stub;
        writeFileSync(dest, preparedStub.content, 'utf8');
        added.push(stub.rel);
        for (const eventFile of preparedStub.eventFiles ?? []) {
          const eventDest = join(repo, eventFile.rel);
          if (existsSync(eventDest)) continue;
          mkdirSync(dirname(eventDest), { recursive: true });
          writeFileSync(eventDest, eventFile.content, 'utf8');
          added.push(eventFile.rel);
        }
      }

      if (added.length === 0) {
        const now = git(repo, ['rev-parse', 'HEAD']).trim();
        if (now !== state.beforeSha) git(repo, ['reset', '--hard', state.beforeSha]);
        git(repo, ['clean', '-fd', '--', 'src/content/news', 'src/content/events']);
      } else {
        runContentChecks(repo);
        commitAddedPaths(repo, added);
        if (push) pushBranch(repo, branch, false);
        result = 'committed';
      }
    } else {
      if (branchExists && hasNonBotCommits(repo, baseRef, branchRef)) {
        throw new Error(
          `${branch} has commits that were not made by this automation, and there is no open pull request. Refusing to overwrite them. Reopen the pull request or delete the branch.`,
        );
      }

      const desiredFiles = [
        ...prepared.map((stub) => ({ rel: stub.rel, content: stub.content })),
        ...createdEvents.map((eventFile) => ({ rel: eventFile.rel, content: eventFile.content })),
        ...carriedEvents,
      ];
      const desired = treeWithStubs(repo, baseRef, desiredFiles);
      if (branchExists) {
        const currentTree = git(repo, ['rev-parse', `${branchRef}^{tree}`]).trim();
        if (currentTree === desired) {
          result = 'needs-pr';
        }
      }

      if (result !== 'needs-pr') {
        state.beforeSha = branchExists ? git(repo, ['rev-parse', branchRef]).trim() : null;
        state.createdBranch = !branchExists;
        git(repo, ['switch', '-C', branch, baseRef]);
        for (const file of desiredFiles) {
          const dest = join(repo, file.rel);
          mkdirSync(dirname(dest), { recursive: true });
          writeFileSync(dest, file.content, 'utf8');
        }
        runContentChecks(repo);
        commitAddedPaths(
          repo,
          desiredFiles.map((file) => file.rel),
        );
        if (push) pushBranch(repo, branch, branchExists);
        result = 'committed';
        state.createdBranch = false;
      }
    }
  } catch (error) {
    rollback(repo, state);
    throw error;
  }

  returnToStart(repo, startBranch);
  writeStepSummary(formatImportSummary({ model, prepared, skippedEvents, dryRun: false }));
  return {
    result,
    branch,
    files: prepared.map((stub) => stub.rel),
    summarized,
    events: createdEvents.map((eventFile) => ({
      path: eventFile.rel,
      title: eventFile.title,
      start: eventFile.start,
      end: eventFile.end,
      location: eventFile.location,
      sourceUrl: eventFile.sourceUrl,
    })),
    skippedEvents,
    fallbacks: prepared
      .filter((stub) => !stub.summarized && stub.fallbackReason)
      .map((stub) => ({ path: stub.rel, reason: stub.fallbackReason })),
  };
}

function printHelp() {
  console.log(`Update the Mailchimp RSS draft-stub branch.

Options:
  --repo <path>         Git checkout (default: cwd)
  --base-ref <ref>      Default branch ref to import from
  --branch <name>       Automation branch name
  --branch-ref <ref>    Existing tip (default: --branch)
  --open-pr <true|false>
  --push                Push the automation branch to origin
  --dry-run             Print summaries and events. Do not commit, push, or open a pull request.
  --file <path>         Read RSS from a file instead of the network
  --result-file <path>  Write JSON { result, branch, files }
  --pr-body-file <path> Write the review pull request body
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  const outcome = args.dryRun ? await dryRunSummaries(args) : await updateAutomationBranch(args);
  if (args.prBodyFile && (outcome.result === 'committed' || outcome.result === 'needs-pr')) {
    writePrBody(
      args.prBodyFile,
      outcome.files,
      outcome.summarized,
      outcome.events,
      outcome.skippedEvents,
      outcome.fallbacks,
    );
  }
  if (args.resultFile) {
    writeFileSync(args.resultFile, `${JSON.stringify(outcome, null, 2)}\n`);
  }
  if (process.env.GITHUB_OUTPUT) {
    writeFileSync(process.env.GITHUB_OUTPUT, `result=${outcome.result}\n`, { flag: 'a' });
  }
  console.log(`rss-stubs-branch: ${outcome.result} (${outcome.files.length} stub path(s))`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
