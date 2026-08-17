#!/usr/bin/env node
/**
 * Fetch a Mailchimp campaign-archive RSS feed (or read a saved copy), print a
 * compact index, and optionally create draft news stubs for campaigns not yet
 * referenced in src/content/news or src/content/events.
 *
 * Usage:
 *   pnpm run rss-to-notes
 *   pnpm run rss-to-notes -- --write
 *   pnpm run rss-to-notes -- --write --dry-run
 *   pnpm run rss-to-notes -- --url https://us18.campaign-archive.com/feed?u=...&id=...
 *   pnpm run rss-to-notes -- --file ./saved-feed.xml
 *   pnpm run rss-to-notes -- --format json
 *
 * With --write, also prints a reminder to run the expand-mailchimp-stubs skill
 * (.cursor/skills/expand-mailchimp-stubs/) to fill stubs and add events.
 *
 * Environment:
 *   RSS_TO_NOTES_URL   Default feed URL when --url is omitted (see docs/rss-to-notes.md).
 */

import { readFileSync, readdirSync, existsSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const NEWS_DIR = join(ROOT, 'src/content/news');

/** Default: NENA Mailchimp archive RSS (public). */
const DEFAULT_FEED_URL =
  'https://us18.campaign-archive.com/feed?u=f1ec16560a226111c086eeb58&id=16f66e5916';

const CONTENT_SCAN_DIRS = [
  join(ROOT, 'src/content/news'),
  join(ROOT, 'src/content/events'),
];

function parseArgs(argv) {
  const out = {
    url: process.env.RSS_TO_NOTES_URL || DEFAULT_FEED_URL,
    file: '',
    format: 'markdown',
    write: false,
    dryRun: false,
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--help' || a === '-h') out.help = true;
    else if (a === '--url') out.url = argv[++i] || out.url;
    else if (a === '--file' || a === '-f') out.file = argv[++i] || '';
    else if (a === '--format') out.format = (argv[++i] || 'markdown').toLowerCase();
    else if (a === '--write' || a === '-w') out.write = true;
    else if (a === '--dry-run') out.dryRun = true;
  }
  if (!['markdown', 'json', 'tsv'].includes(out.format)) {
    console.error(`rss-to-notes: unknown --format ${out.format} (use markdown, json, or tsv)`);
    process.exit(2);
  }
  if (out.dryRun && !out.write) {
    console.error('rss-to-notes: --dry-run requires --write');
    process.exit(2);
  }
  return out;
}

function stripPreamble(text) {
  if (text.startsWith('Source URL:')) {
    const idx = text.indexOf('<?xml');
    if (idx !== -1) return text.slice(idx);
  }
  return text;
}

function parseRssItems(xml) {
  const itemsXml = xml.split('<item>').slice(1);
  const rows = [];
  for (const chunk of itemsXml) {
    const mTitle = chunk.match(/<title><!\[CDATA\[([\s\S]*?)\]\]><\/title>/);
    const mTitlePlain = !mTitle ? chunk.match(/<title>([^<]*)<\/title>/) : null;
    const mLink = chunk.match(/<link>([^<\s]+)<\/link>/);
    const mGuid = chunk.match(/<guid(?:[^>]*)>([^<]+)<\/guid>/);
    const mPub = chunk.match(/<pubDate>([^<]+)<\/pubDate>/);
    const title = (mTitle?.[1] ?? mTitlePlain?.[1] ?? '').trim();
    const link = (mLink?.[1] ?? '').trim();
    const guid = (mGuid?.[1] ?? '').trim();
    const pubDate = (mPub?.[1] ?? '').trim();
    if (title || link) {
      rows.push({ title, link, guid, pubDate });
    }
  }
  return rows;
}

/** @param {string} url */
function mailchiCampaignId(url) {
  if (!url) return '';
  const m = url.match(/mailchi\.mp\/([^/?#]+)/i);
  return m?.[1]?.toLowerCase() ?? '';
}

/** @param {string} pubDate */
function isoDateFromPubDate(pubDate) {
  if (!pubDate) return '';
  const d = new Date(pubDate);
  if (Number.isNaN(d.getTime())) return '';
  return d.toISOString().slice(0, 10);
}

/** @param {string} title */
function slugFromTitle(title) {
  const slug = title
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80)
    .replace(/-+$/g, '');
  return slug || 'mailchimp-campaign';
}

function listMarkdownFiles(dir) {
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((name) => name.endsWith('.md'))
    .map((name) => join(dir, name));
}

function loadKnownCampaignIds() {
  /** @type {Set<string>} */
  const ids = new Set();
  for (const dir of CONTENT_SCAN_DIRS) {
    for (const filePath of listMarkdownFiles(dir)) {
      const text = readFileSync(filePath, 'utf8');
      for (const m of text.matchAll(/mailchi\.mp\/([^/?#\s"'<>]+)/gi)) {
        ids.add(m[1].toLowerCase());
      }
    }
  }
  return ids;
}

/** @param {string} dir @param {string} dateStr @param {string} slug */
function resolveNewsFilePath(dir, dateStr, slug) {
  const base = `${dateStr}-${slug}`;
  let candidate = join(dir, `${base}.md`);
  if (!existsSync(candidate)) return candidate;
  for (let n = 2; n < 100; n++) {
    candidate = join(dir, `${base}-${n}.md`);
    if (!existsSync(candidate)) return candidate;
  }
  throw new Error(`Could not find unused filename for ${base}.md`);
}

/** @param {{ title: string, link: string, pubDate: string }} row */
function buildNewsStub(row) {
  const date = isoDateFromPubDate(row.pubDate);
  if (!date) {
    throw new Error(`Missing or invalid pubDate for "${row.title}"`);
  }
  const frontmatter = {
    title: row.title,
    date,
    summary:
      'Draft stub from Mailchimp campaign — expand from the archive link before publishing.',
    featured: false,
    draft: true,
    tags: [],
    topics: [],
    ...(row.link ? { mailchimpArchiveUrl: row.link } : {}),
  };
  const fm = yaml.dump(frontmatter, { lineWidth: -1, noRefs: true }).trimEnd();
  return `---\n${fm}\n---\n\n`;
}

/**
 * @param {ReturnType<typeof parseRssItems>} rows
 * @param {{ dryRun: boolean }} opts
 */
function writeMissingStubs(rows, opts) {
  const knownIds = loadKnownCampaignIds();
  if (!existsSync(NEWS_DIR)) mkdirSync(NEWS_DIR, { recursive: true });

  let written = 0;
  let skippedKnown = 0;
  let skippedNoLink = 0;
  /** @type {string[]} */
  const errors = [];

  for (const row of rows) {
    const campaignId = mailchiCampaignId(row.link) || mailchiCampaignId(row.guid);
    if (!campaignId) {
      skippedNoLink++;
      continue;
    }
    if (knownIds.has(campaignId)) {
      skippedKnown++;
      continue;
    }

    let filePath;
    try {
      const date = isoDateFromPubDate(row.pubDate);
      if (!date) throw new Error(`missing pubDate`);
      filePath = resolveNewsFilePath(NEWS_DIR, date, slugFromTitle(row.title));
      const content = buildNewsStub(row);
      if (opts.dryRun) {
        console.log(`[dry-run] would write ${filePath.replace(ROOT + '/', '')}`);
      } else {
        writeFileSync(filePath, content, 'utf8');
        console.log(`Wrote ${filePath.replace(ROOT + '/', '')}`);
        knownIds.add(campaignId);
      }
      written++;
    } catch (e) {
      errors.push(
        `"${row.title}": ${e instanceof Error ? e.message : String(e)}`,
      );
    }
  }

  const prefix = opts.dryRun ? 'Would write' : 'Wrote';
  console.log(
    `${prefix} ${written} draft news stub(s); skipped ${skippedKnown} already in content, ${skippedNoLink} without archive link.`,
  );
  printSkillReminder(opts.dryRun);
  if (errors.length > 0) {
    console.error('rss-to-notes: failed to create stub(s):');
    for (const err of errors) console.error(`  - ${err}`);
    process.exit(1);
  }
}

function printSkillReminder(dryRun) {
  const next = dryRun
    ? 'After writing stubs, run the expand-mailchimp-stubs skill'
    : 'Next: run the expand-mailchimp-stubs skill';
  console.log('');
  console.log(
    `${next} to fill draft news from each Mailchimp archive and create event pages when the email is a gathering.`,
  );
  console.log('  .cursor/skills/expand-mailchimp-stubs/');
}

function escapeMdCell(s) {
  return String(s).replace(/\|/g, '\\|').replace(/\r?\n/g, ' ');
}

async function loadXml({ url, file }) {
  if (file) {
    const p = resolve(process.cwd(), file);
    if (!existsSync(p)) {
      console.error(`rss-to-notes: file not found: ${p}`);
      process.exit(1);
    }
    return stripPreamble(readFileSync(p, 'utf8'));
  }
  const res = await fetch(url, {
    headers: { Accept: 'application/rss+xml, application/xml, text/xml, */*' },
    redirect: 'follow',
  });
  if (!res.ok) {
    console.error(`rss-to-notes: HTTP ${res.status} ${res.statusText} for ${url}`);
    process.exit(1);
  }
  return await res.text();
}

function printMarkdown(rows, sourceLabel) {
  console.log(`<!-- ${sourceLabel} — generated by scripts/rss-to-notes.mjs -->`);
  console.log('');
  console.log('| # | Pub date | Title | Archive link |');
  console.log('|---:|---|---|---|');
  rows.forEach((r, i) => {
    const title = escapeMdCell(r.title || '—');
    const link = r.link ? `[open](${r.link})` : '—';
    const pub = escapeMdCell(r.pubDate || '—');
    console.log(`| ${i + 1} | ${pub} | ${title} | ${link} |`);
  });
  console.log('');
}

function printJson(rows, sourceLabel) {
  console.log(
    JSON.stringify(
      { source: sourceLabel, count: rows.length, items: rows },
      null,
      2,
    ),
  );
}

function printTsv(rows) {
  console.log(['pubDate', 'title', 'link', 'guid'].join('\t'));
  for (const r of rows) {
    console.log(
      [r.pubDate, r.title, r.link, r.guid]
        .map((c) => String(c).replace(/\t/g, ' ').replace(/\r?\n/g, ' '))
        .join('\t'),
    );
  }
}

function printHelp() {
  console.log(`rss-to-notes — list campaigns from a Mailchimp archive RSS feed

Usage:
  pnpm run rss-to-notes [options]

Options:
  --url <url>       Feed URL (default: NENA archive or RSS_TO_NOTES_URL)
  --file, -f <path> Read XML from file instead of fetching (e.g. saved export)
  --format <fmt>    markdown | json | tsv (default: markdown)
  --write, -w       Create draft news stubs for campaigns not yet in content
  --dry-run         With --write, show paths without writing files
  --help, -h        This help

After --write, fill stubs with the expand-mailchimp-stubs skill
  (.cursor/skills/expand-mailchimp-stubs/).

Examples:
  pnpm run rss-to-notes
  pnpm run rss-to-notes -- --write
  pnpm run rss-to-notes -- --write --dry-run
  pnpm run rss-to-notes -- --format json
  pnpm run rss-to-notes -- --file ./feed.xml --format tsv
`);
}

async function main() {
  const argv = process.argv.slice(2);
  const opts = parseArgs(argv);
  if (opts.help) {
    printHelp();
    process.exit(0);
  }

  const sourceLabel = opts.file ? `file:${resolve(process.cwd(), opts.file)}` : opts.url;
  let xml;
  try {
    xml = await loadXml(opts);
  } catch (e) {
    console.error('rss-to-notes:', e instanceof Error ? e.message : e);
    process.exit(1);
  }

  const rows = parseRssItems(xml);
  if (opts.format === 'json') printJson(rows, sourceLabel);
  else if (opts.format === 'tsv') printTsv(rows);
  else printMarkdown(rows, sourceLabel);

  if (opts.write) {
    console.log('---');
    writeMissingStubs(rows, { dryRun: opts.dryRun });
  }
}

main();
