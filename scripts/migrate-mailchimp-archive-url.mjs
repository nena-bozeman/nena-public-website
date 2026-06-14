#!/usr/bin/env node
/**
 * One-time migration: move inline Mailchimp archive footers into mailchimpArchiveUrl frontmatter.
 *
 * Usage:
 *   node scripts/migrate-mailchimp-archive-url.mjs          # dry run
 *   node scripts/migrate-mailchimp-archive-url.mjs --write
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const NEWS_DIR = join(__dirname, '../src/content/news');
const write = process.argv.includes('--write');

/** Lines that identify this post's own Mailchimp archive (not cross-references). */
const ARCHIVE_LINE =
  /^\*\*(?:Original email \(web version\)|Original announcement \(web version\)|Archive):\*\* \[([^\]]*)\]\((https:\/\/mailchi\.mp\/[^)]+)\)\s*$/m;

function parseFrontmatter(text) {
  if (!text.startsWith('---\n')) return null;
  const end = text.indexOf('\n---\n', 4);
  if (end === -1) return null;
  return {
    frontmatter: text.slice(4, end),
    body: text.slice(end + 5),
    endIndex: end + 5,
  };
}

function addMailchimpArchiveUrl(frontmatter, url) {
  if (/^mailchimpArchiveUrl:/m.test(frontmatter)) {
    return frontmatter;
  }
  return `${frontmatter.trimEnd()}\nmailchimpArchiveUrl: ${url}\n`;
}

function stripArchiveFooter(body) {
  return body.replace(ARCHIVE_LINE, '').replace(/\n{3,}/g, '\n\n').replace(/\s+$/, '');
}

function migrateFile(filePath) {
  const original = readFileSync(filePath, 'utf8');
  const parsed = parseFrontmatter(original);
  if (!parsed) return { status: 'skip', reason: 'no frontmatter' };

  const match = parsed.body.match(ARCHIVE_LINE);
  if (!match) return { status: 'skip', reason: 'no archive line' };

  const url = match[2];
  const newFrontmatter = addMailchimpArchiveUrl(parsed.frontmatter, url);
  const newBody = stripArchiveFooter(parsed.body);
  const updated = `---\n${newFrontmatter}---\n\n${newBody}${newBody.endsWith('\n') ? '' : '\n'}`;

  if (updated === original) return { status: 'skip', reason: 'unchanged' };

  if (write) writeFileSync(filePath, updated, 'utf8');
  return { status: write ? 'updated' : 'would-update', url };
}

const files = readdirSync(NEWS_DIR)
  .filter((name) => name.endsWith('.md'))
  .map((name) => join(NEWS_DIR, name));

/** @type {{ updated: string[], skipped: string[] }} */
const report = { updated: [], skipped: [] };

for (const filePath of files) {
  const result = migrateFile(filePath);
  const name = filePath.split('/').pop() ?? filePath;
  if (result.status === 'updated' || result.status === 'would-update') {
    report.updated.push(`${name} → ${result.url}`);
  } else {
    report.skipped.push(`${name} (${result.reason})`);
  }
}

console.log(write ? 'Updated:' : 'Would update:');
for (const line of report.updated) console.log(`  ${line}`);
console.log(`\nSkipped (${report.skipped.length}):`);
for (const line of report.skipped) console.log(`  ${line}`);
