#!/usr/bin/env node
/**
 * Emit Cloudflare _redirects rules for legacy Pyro CMS /blog/YYYY/MM/slug URLs.
 * Sources legacyBlogUrl from src/content/news/*.md frontmatter.
 *
 * Usage: node scripts/build-blog-redirects.mjs [--write]
 *   --write  Patch public/_redirects between marker comments (default: stdout only)
 */

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const NEWS_DIR = join(ROOT, 'src', 'content', 'news');
const REDIRECTS_FILE = join(ROOT, 'public', '_redirects');

const BEGIN = '# BEGIN legacy-blog-redirects (pnpm redirects:blog)';
const END = '# END legacy-blog-redirects';

function normPath(p) {
  if (!p || p === '/') return '/';
  const s = p.split('?')[0].split('#')[0];
  if (s === '/') return '/';
  return s.replace(/\/+$/, '') || '/';
}

function parseLegacyBlogUrl(markdown) {
  const match = markdown.match(/^legacyBlogUrl:\s*(\S+)/m);
  return match ? match[1].trim() : null;
}

function collectBlogRedirects() {
  /** @type {Array<{ from: string; to: string }>} */
  const rules = [];

  for (const file of readdirSync(NEWS_DIR).filter((f) => f.endsWith('.md')).sort()) {
    const markdown = readFileSync(join(NEWS_DIR, file), 'utf8');
    const legacyBlogUrl = parseLegacyBlogUrl(markdown);
    if (!legacyBlogUrl) continue;

    let legacyPath;
    try {
      legacyPath = normPath(new URL(legacyBlogUrl).pathname);
    } catch {
      console.warn(`Skipping ${file}: invalid legacyBlogUrl ${legacyBlogUrl}`);
      continue;
    }

    const dest = `/news/${basename(file, '.md')}`;
    if (legacyPath === dest) continue;

    rules.push({ from: legacyPath, to: dest });
  }

  return rules.sort((a, b) => {
    if (a.from.length !== b.from.length) return b.from.length - a.from.length;
    return a.from.localeCompare(b.from);
  });
}

function formatSection(rules) {
  const lines = [
    BEGIN,
    '# Legacy Pyro CMS /blog/YYYY/MM/slug → /news/YYYY-MM-DD-slug',
    '',
  ];
  for (const { from, to } of rules) {
    lines.push(`${from} ${to} 301`);
  }
  lines.push(END);
  return lines.join('\n');
}

function patchRedirectsFile(section) {
  const current = readFileSync(REDIRECTS_FILE, 'utf8');
  const pattern = new RegExp(
    `${BEGIN.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}[\\s\\S]*?${END.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`,
  );

  if (pattern.test(current)) {
    writeFileSync(REDIRECTS_FILE, current.replace(pattern, section), 'utf8');
    return;
  }

  const trimmed = current.replace(/\n+$/, '');
  writeFileSync(REDIRECTS_FILE, `${trimmed}\n\n${section}\n`, 'utf8');
}

function main() {
  const write = process.argv.includes('--write');
  const rules = collectBlogRedirects();
  const section = formatSection(rules);

  if (write) {
    patchRedirectsFile(section);
    console.log(`Wrote ${rules.length} legacy blog redirects to ${REDIRECTS_FILE}`);
  } else {
    process.stdout.write(`${section}\n`);
    console.error(`${rules.length} rules (pass --write to update ${REDIRECTS_FILE})`);
  }
}

main();
