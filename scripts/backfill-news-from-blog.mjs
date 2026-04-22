/**
 * Generates src/content/news/*.md from Pyro CMS blog export (blog.json).
 * Only includes posts with status "live" (excludes drafts).
 *
 * Usage: node scripts/backfill-news-from-blog.mjs
 * Optional: DRY_RUN=1 node scripts/backfill-news-from-blog.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import TurndownService from 'turndown';
import yaml from 'js-yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const BLOG_JSON = path.join(ROOT, 'data/website-2026-04-21/blog.json');
const LEGACY_CSV = path.join(ROOT, 'data/legacy-inventory.csv');
const OUT_DIR = path.join(ROOT, 'src/content/news');

const SITE_ORIGIN = 'https://www.nenabozeman.org';

const dryRun = process.env.DRY_RUN === '1';

function parseCsvLine(line) {
  const result = [];
  let cur = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (c === ',' && !inQuotes) {
      result.push(cur);
      cur = '';
      continue;
    }
    cur += c;
  }
  result.push(cur);
  return result;
}

/** Canonical legacy blog post URLs from inventory (path month may differ from export timestamps). */
function loadLegacyBlogUrlsBySlug() {
  const map = new Map();
  const text = fs.readFileSync(LEGACY_CSV, 'utf8');
  const lines = text.split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols[1] !== 'page') continue;
    const url = cols[0];
    const m = url.match(/\/blog\/\d{4}\/\d{2}\/([^/?#]+)\/?$/);
    if (m) map.set(m[1], url);
  }
  return map;
}

/** @returns {Map<string, string>} file download id -> site path e.g. /documents/migrated/... */
function loadDownloadPathMap() {
  const map = new Map();
  const text = fs.readFileSync(LEGACY_CSV, 'utf8');
  const lines = text.split(/\r?\n/);
  for (let i = 1; i < lines.length; i++) {
    const cols = parseCsvLine(lines[i]);
    if (cols[1] !== 'file_download') continue;
    const url = cols[0];
    const local = cols[4];
    const m = url.match(/files\/download\/([a-f0-9]+)/);
    if (!m || !local || !local.startsWith('public/')) continue;
    map.set(m[1], '/' + local.replace(/^public\//, ''));
  }
  return map;
}

function rewriteHtml(html, downloadMap) {
  if (!html) return '';
  let h = html.replaceAll('{{ url:site }}', `${SITE_ORIGIN}/`);
  h = h.replace(/href="[^"]*\/files\/download\/([a-f0-9]+)"/g, (_, id) => {
    const local = downloadMap.get(id);
    if (local) return `href="${local}"`;
    return `href="${SITE_ORIGIN}/files/download/${id}"`;
  });
  return h;
}

function stripTags(html) {
  if (!html) return '';
  return html
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function makeSummary(introHtml, bodyHtml, max = 280) {
  let s = stripTags(introHtml);
  if (s.length < 50) s = stripTags(bodyHtml);
  if (s.length > max) s = `${s.slice(0, max - 1).trimEnd()}…`;
  return s || 'News post migrated from the previous NENA website.';
}

function extractAuthor(html) {
  if (!html) return undefined;
  const m =
    html.match(/<em>Posted by[^]*?<a[^>]*>([^<]+)<\/a>/i) ||
    html.match(/Posted by\s*(?:<[^>]+>\s*)*<a[^>]*>([^<]+)<\/a>/i);
  return m ? m[1].replace(/\s+/g, ' ').trim() : undefined;
}

function isoDateFromUnix(sec) {
  const d = new Date(sec * 1000);
  return d.toISOString().slice(0, 10);
}

function resolveLegacyBlogUrl(slug, createdSec, legacyBySlug) {
  return legacyBySlug.get(slug) ?? (() => {
    const d = new Date(createdSec * 1000);
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    return `${SITE_ORIGIN}/blog/${y}/${mo}/${slug}`;
  })();
}

const td = new TurndownService({
  headingStyle: 'atx',
  codeBlockStyle: 'fenced',
  bulletListMarker: '-',
});

function fixMarkdownAngleLinkWrappers(md) {
  return md.replace(/]\(<([^>]+)>\)/g, ']($1)');
}

function htmlToMarkdown(html) {
  const trimmed = html?.trim();
  if (!trimmed) return '_No body content._';
  let md = td.turndown(trimmed);
  md = md.replace(/\n{3,}/g, '\n\n');
  md = fixMarkdownAngleLinkWrappers(md);
  md = md.replace(/]\((\/[^)]+)\)/g, (full, path) => {
    if (path.includes('%')) return full;
    if (path.includes(' ')) return `](${encodeURI(path)})`;
    return full;
  });
  return md.trim() || '_No body content._';
}

function buildFrontmatter(post, { summary, author, legacyBySlug }) {
  const date = isoDateFromUnix(post.created_on);
  const updated =
    post.updated_on && post.updated_on !== post.created_on ? isoDateFromUnix(post.updated_on) : undefined;

  const data = {
    title: post.title?.trim() || post.slug,
    date,
    summary,
    featured: false,
    tags: [],
    legacySource: 'pyro-cms',
    legacyId: post.id != null ? String(post.id) : undefined,
    legacySlug: post.slug,
    legacyBlogUrl: resolveLegacyBlogUrl(post.slug, post.created_on, legacyBySlug),
  };
  if (author) data.author = author;
  if (updated) data.dateUpdated = updated;

  return yaml.dump(data, {
    lineWidth: -1,
    noRefs: true,
    quotingType: '"',
    forceQuotes: false,
  });
}

function main() {
  const downloadMap = loadDownloadPathMap();
  const legacyBySlug = loadLegacyBlogUrlsBySlug();
  const posts = JSON.parse(fs.readFileSync(BLOG_JSON, 'utf8'));
  const live = posts.filter((p) => p.status === 'live');
  if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });

  let written = 0;
  for (const post of live) {
    const dateStr = isoDateFromUnix(post.created_on);
    const baseName = `${dateStr}-${post.slug}`.replace(/[/\\?%*:|"<>]/g, '-');
    const filePath = path.join(OUT_DIR, `${baseName}.md`);

    const intro = rewriteHtml(post.intro || '', downloadMap);
    const body = rewriteHtml(post.body || '', downloadMap);
    const author = extractAuthor(body) || extractAuthor(intro);
    const summary = makeSummary(post.intro, post.body);

    let combinedHtml = '';
    if (intro) combinedHtml += intro;
    if (intro && body) combinedHtml += '<hr />';
    if (body) combinedHtml += body;

    const bodyMd = htmlToMarkdown(combinedHtml);
    const fm = buildFrontmatter(post, { summary, author, legacyBySlug });
    const fileContent = `---\n${fm}---\n\n${bodyMd}\n`;

    if (dryRun) {
      console.log('[dry-run] would write', path.relative(ROOT, filePath));
      written++;
      continue;
    }
    fs.writeFileSync(filePath, fileContent, 'utf8');
    written++;
  }

  console.log(`Wrote ${written} news post(s) from ${live.length} live blog entr(y|ies).`);
}

main();
