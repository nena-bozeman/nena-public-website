#!/usr/bin/env node
/**
 * Build a CSV (and JSON) inventory of www.nenabozeman.org:
 * - Discovers URLs from RSS, blog sitemap, pages sitemap
 * - Optionally crawls each HTML page for linked assets (default: on)
 * - Columns: downloaded (file in repo?), migrated (heuristic), new_site_path, etc.
 *
 * Usage: node scripts/build-legacy-inventory.mjs [--no-crawl-assets] [--no-fetch]
 *   --no-fetch  Use only cached files under data/.cache (for offline dev if present)
 */

import { writeFileSync, mkdirSync, readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const OUT_CSV = join(ROOT, 'data', 'legacy-inventory.csv');
const OUT_JSON = join(ROOT, 'data', 'legacy-inventory.json');
const CACHE_DIR = join(ROOT, 'data', '.cache', 'legacy-fetch');
const IMG_ROOT = join(ROOT, 'public', 'images', 'migrated', 'nenabozeman-org');
const DOC_ROOT = join(ROOT, 'public', 'documents', 'migrated', 'nenabozeman-org');
const CONTENT_DIR = join(ROOT, 'src', 'content');

const UA = 'Mozilla/5.0 (compatible; NENA-inventory/1.0)';
const HOST = 'www.nenabozeman.org';

const args = new Set(process.argv.slice(2));
const NO_CRAWL = args.has('--no-crawl-assets');
const NO_FETCH = args.has('--no-fetch');

/** @type {Record<string, string>} */
const STATIC_PAGE_MAP = {
  '/': '/',
  '/home': '/',
  '/about': '/about',
  '/donate': '/donate',
  '/elections': '/elections',
  '/email-signup': '/newsletter',
  '/ne-business-directory': '/businesses',
  '/upcoming-events': '/events',
  '/events-calendar': '/events',
  '/thank-you': '',
  '/search': '',
  '/search/results': '',
  '/photovoicesne': '/objectives/visionne',
  '/users/login': '',
  '/register': '',
  '/objectives': '/objectives',
};

/** Legacy /objectives/<slug> -> new Astro objective slug (filename without .md) */
const OBJECTIVE_SLUG_MAP = {
  trailsandpocketparks: 'trails-pocket-parks',
  'vision-ne': 'visionne',
  udc: 'bozeman-udc',
  'nena-bylaws-2024': '',
  'trees-2': 'trees',
  'udc/interim-zoning-2026': 'bozeman-udc',
};

function escapeCsv(value) {
  const s = value == null ? '' : String(value);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function normalizeUrl(raw) {
  let u = raw.trim().replace(/\s/g, '');
  if (u.startsWith('//')) u = `https:${u}`;
  try {
    const parsed = new URL(u);
    if (parsed.hostname === 'nenabozeman.org') {
      parsed.hostname = HOST;
    }
    if (parsed.hostname !== HOST) return null;
    parsed.hash = '';
    let path = parsed.pathname.replace(/\/+$/, '') || '/';
    if (path !== '/' && path.endsWith('/')) path = path.slice(0, -1);
    parsed.pathname = path;
    return parsed.toString();
  } catch {
    return null;
  }
}

async function fetchText(url) {
  if (NO_FETCH && existsSync(join(CACHE_DIR, cacheKey(url)))) {
    return readFileSync(join(CACHE_DIR, cacheKey(url)), 'utf8');
  }
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${res.status} ${url}`);
  const text = await res.text();
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(join(CACHE_DIR, cacheKey(url)), text, 'utf8');
  return text;
}

function cacheKey(url) {
  return encodeURIComponent(url).slice(0, 200);
}

/** @returns {string[]} */
function parseSitemapLocs(xml) {
  const locs = [];
  const re = /<loc>([^<]+)<\/loc>/g;
  let m;
  while ((m = re.exec(xml))) {
    const n = normalizeUrl(m[1].trim());
    if (n) locs.push(n);
  }
  return locs;
}

/** @returns {Map<string, string>} url -> title */
function parseRssItemMeta(xml) {
  const map = new Map();
  const itemRe = /<item>([\s\S]*?)<\/item>/gi;
  let im;
  while ((im = itemRe.exec(xml))) {
    const block = im[1];
    const lm = block.match(/<link>([^<]+)<\/link>/i);
    const tm = block.match(/<title>([^<]*)<\/title>/i);
    if (!lm) continue;
    const link = normalizeUrl(lm[1].trim());
    if (link) map.set(link, tm ? tm[1].trim() : '');
  }
  return map;
}

function extractUrlsFromHtml(html) {
  const found = new Set();
  const add = (raw) => {
    const n = normalizeUrl(raw);
    if (n) found.add(n);
  };

  const abs = html.matchAll(/https:\/\/www\.nenabozeman\.org[^"'\\s<>)]+/gi);
  for (const m of abs) add(m[0]);

  const proto = html.matchAll(/\/\/www\.nenabozeman\.org[^"'\\s<>)]+/gi);
  for (const m of proto) add(`https:${m[0].slice(2)}`);

  const relFiles = html.matchAll(/\/files\/(?:download|large|medium|small)\/[0-9a-f]+/gi);
  for (const m of relFiles) add(`https://${HOST}${m[0]}`);

  const relAddons = html.matchAll(
    /\/addons\/shared_addons\/[^"'\\s<>)]+\.(?:jpg|jpeg|png|gif|webp|svg|ico)/gi,
  );
  for (const m of relAddons) add(`https://${HOST}${m[0]}`);

  const relPdf = html.matchAll(/\/[^"'\\s<>)]+\.pdf(?:\?[^"'\\s<>)]*)?/gi);
  for (const m of relPdf) {
    if (m[0].startsWith('//')) continue;
    if (!m[0].startsWith('/')) continue;
    add(`https://${HOST}${m[0]}`);
  }

  return [...found];
}

function classifyUrl(url) {
  const u = new URL(url);
  const p = u.pathname;
  if (p.match(/\.(css|js)$/i)) return 'static_script_or_css';
  if (p.includes('/files/download/')) return 'file_download';
  if (p.includes('/files/large/') || p.includes('/files/medium/') || p.includes('/files/small/'))
    return 'image_upload';
  if (p.includes('/addons/') && /\.(jpg|jpeg|png|gif|webp|svg|ico)$/i.test(p)) return 'image_theme';
  if (p.endsWith('.pdf') || p.includes('.pdf?')) return 'pdf_link';
  if (p.startsWith('/blog/') || p === '/blog') return 'page';
  if (
    p === '/' ||
    !/\.(jpg|jpeg|png|gif|webp|svg|ico|pdf|docx?|zip)$/i.test(p) ||
    p.startsWith('/objectives') ||
    p.startsWith('/about') ||
    p.startsWith('/ne-') ||
    p.startsWith('/upcoming') ||
    p.startsWith('/donate') ||
    p.startsWith('/elections') ||
    p.startsWith('/email') ||
    p.startsWith('/users') ||
    p.startsWith('/register') ||
    p.startsWith('/search') ||
    p.startsWith('/thank') ||
    p.startsWith('/events') ||
    p.startsWith('/photovoices')
  )
    return 'page';
  return 'other';
}

function safeDecodeURIComponent(s) {
  try {
    return decodeURIComponent(s.trim());
  } catch {
    return s.trim();
  }
}

async function headDownloadFilename(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', headers: { 'User-Agent': UA } });
    if (!res.ok) return '';
    const cd = res.headers.get('content-disposition') || '';
    const quoted = cd.match(/filename="([^"]+)"/i);
    if (quoted) return safeDecodeURIComponent(quoted[1]);
    const utf = cd.match(/filename\*=UTF-8''([^;]+)/i);
    if (utf) return safeDecodeURIComponent(utf[1]);
  } catch {
    /* ignore */
  }
  return '';
}

async function resolveDownloadedPath(url) {
  const u = new URL(url);
  const p = u.pathname;
  if (p.startsWith('/addons/')) {
    const rel = join(IMG_ROOT, p);
    return existsSync(rel) ? `public/images/migrated/nenabozeman-org${p}` : '';
  }
  if (p.match(/^\/files\/large\/[0-9a-f]+$/i)) {
    const id = p.split('/').pop();
    for (const ext of ['.jpg', '.jpeg', '.png', '.gif', '.webp']) {
      const rel = join(IMG_ROOT, 'files', 'large', `${id}${ext}`);
      if (existsSync(rel)) return `public/images/migrated/nenabozeman-org/files/large/${id}${ext}`;
    }
    return '';
  }
  if (p.includes('/files/download/')) {
    const fname = await headDownloadFilename(url);
    if (fname) {
      const safe = fname.replace(/[/\\]/g, '_');
      const rel = join(DOC_ROOT, safe);
      if (existsSync(rel)) return `public/documents/migrated/nenabozeman-org/${safe}`;
    }
    const id = p.split('/').pop();
    if (existsSync(DOC_ROOT)) {
      for (const name of readdirSync(DOC_ROOT)) {
        if (name.includes(id)) return `public/documents/migrated/nenabozeman-org/${name}`;
      }
    }
    return '';
  }
  if (p.toLowerCase().endsWith('.pdf')) {
    const base = decodeURIComponent(p.split('/').pop() || '');
    const rel = join(DOC_ROOT, base);
    if (existsSync(rel)) return `public/documents/migrated/nenabozeman-org/${base}`;
  }
  return '';
}

function loadNewsPosts() {
  const dir = join(CONTENT_DIR, 'news');
  if (!existsSync(dir)) return [];
  return readdirSync(dir)
    .filter((f) => f.endsWith('.md'))
    .map((f) => {
      const slug = f.replace(/\.md$/, '');
      const raw = readFileSync(join(dir, f), 'utf8');
      const tm = raw.match(/^title:\s*"([^"]*)"\s*$/m);
      const title = tm ? tm[1].trim() : slug;
      return { slug, title, file: `src/content/news/${f}` };
    });
}

function decodeHtmlEntities(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(parseInt(d, 10)))
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/g, "'");
}

function normalizeTitle(s) {
  return decodeHtmlEntities(s)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function titleMatchScore(a, b) {
  if (!a || !b) return 0;
  const A = new Set(normalizeTitle(a).split(' ').filter(Boolean));
  const B = new Set(normalizeTitle(b).split(' ').filter(Boolean));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const w of A) if (B.has(w)) inter++;
  return inter / Math.min(A.size, B.size);
}

function legacyBlogYear(url) {
  const m = url.match(/\/blog\/(\d{4})\//);
  return m ? parseInt(m[1], 10) : null;
}

function newsPostYearFromSlug(slug) {
  const m = slug.match(/^(\d{4})-/);
  return m ? parseInt(m[1], 10) : null;
}

function suggestNewsPath(legacyBlogUrl, rssTitle, newsPosts) {
  const legacyYear = legacyBlogYear(legacyBlogUrl);
  let best = null;
  let bestScore = 0;
  for (const post of newsPosts) {
    const postYear = newsPostYearFromSlug(post.slug);
    if (legacyYear != null && postYear != null && legacyYear !== postYear) continue;
    const s = titleMatchScore(rssTitle || '', post.title);
    if (s > bestScore) {
      bestScore = s;
      best = post;
    }
  }
  if (best && bestScore >= 0.55) {
    const migrated = bestScore >= 0.72 ? 'yes' : 'partial';
    return { path: `/news/${best.slug}`, migrated, score: bestScore };
  }
  const m = legacyBlogUrl.match(/\/blog\/\d+\/\d+\/([^/?#]+)/);
  const legacySlug = m ? m[1] : '';
  return {
    path: legacySlug ? `/news/(suggested legacy slug: ${legacySlug})` : '',
    migrated: 'no',
    score: bestScore,
  };
}

function suggestPagePath(legacyUrl, rssTitleByUrl, newsPosts) {
  const u = new URL(legacyUrl);
  let path = u.pathname.replace(/\/+$/, '') || '/';

  if (path.startsWith('/blog')) {
    const title = rssTitleByUrl.get(legacyUrl) || '';
    const r = suggestNewsPath(legacyUrl, title, newsPosts);
    return { newSitePath: r.path, migrated: r.migrated, notes: `title_match_score=${r.score.toFixed(2)}` };
  }

  if (STATIC_PAGE_MAP[path] !== undefined) {
    const np = STATIC_PAGE_MAP[path];
    return { newSitePath: np, migrated: np ? 'yes' : 'no', notes: np ? '' : 'no direct route yet' };
  }

  if (path.startsWith('/objectives/')) {
    const rest = path.slice('/objectives/'.length);
    const segments = rest.split('/');
    const legacySlug = segments[0];
    const mapped = OBJECTIVE_SLUG_MAP[rest] ?? OBJECTIVE_SLUG_MAP[legacySlug];
    if (mapped === '') {
      return { newSitePath: '', migrated: 'no', notes: 'needs new objective or page' };
    }
    const slug = mapped || legacySlug;
    const md = join(CONTENT_DIR, 'objectives', `${slug}.md`);
    const exists = existsSync(md);
    return {
      newSitePath: `/objectives/${slug}`,
      migrated: exists ? 'yes' : 'partial',
      notes: segments.length > 1 ? 'legacy child path; may need section anchor' : '',
    };
  }

  return { newSitePath: '', migrated: 'unknown', notes: 'unmapped' };
}

function scanRepoForSubstring(sub) {
  if (!sub) return false;
  const roots = [join(ROOT, 'src')];
  const stack = [...roots];
  while (stack.length) {
    const d = stack.pop();
    if (!existsSync(d)) continue;
    for (const name of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, name.name);
      if (name.isDirectory()) {
        if (name.name === 'node_modules' || name.name === 'dist') continue;
        stack.push(p);
      } else if (/\.(md|mdx|astro|html|yml|yaml|json|css)$/i.test(name.name)) {
        try {
          const t = readFileSync(p, 'utf8');
          if (t.includes(sub)) return true;
        } catch {
          /* skip */
        }
      }
    }
  }
  return false;
}

async function main() {
  mkdirSync(join(ROOT, 'data'), { recursive: true });

  const rssXml = await fetchText(`https://${HOST}/blog/rss/all.rss`);
  const rssTitles = parseRssItemMeta(rssXml);

  const sitemapIndex = await fetchText(`https://${HOST}/sitemap.xml`);
  const submapUrls = parseSitemapLocs(sitemapIndex);
  const pageUrls = new Set();
  for (const sm of submapUrls) {
    await delay(150);
    const xml = await fetchText(sm);
    for (const loc of parseSitemapLocs(xml)) pageUrls.add(loc);
  }
  for (const u of rssTitles.keys()) pageUrls.add(u);

  const newsPosts = loadNewsPosts();

  /** @type {Map<string, { kind: string, sources: Set<string> }>} */
  const assetIndex = new Map();

  if (!NO_CRAWL) {
    const sortedPages = [...pageUrls].sort();
    let i = 0;
    for (const pageUrl of sortedPages) {
      i += 1;
      const kind = classifyUrl(pageUrl);
      if (kind !== 'page' && kind !== 'other') continue;
      if (!pageUrl.includes(HOST)) continue;
      try {
        process.stderr.write(`\rCrawl ${i}/${sortedPages.length} ${pageUrl.slice(0, 70).padEnd(70)}`);
        await delay(120);
        const html = await fetchText(pageUrl);
        for (const raw of extractUrlsFromHtml(html)) {
          const k = classifyUrl(raw);
          if (k === 'page' || k === 'static_script_or_css') continue;
          if (!assetIndex.has(raw)) assetIndex.set(raw, { kind: k, sources: new Set() });
          assetIndex.get(raw).sources.add(pageUrl);
        }
      } catch (e) {
        process.stderr.write(`\nwarn: ${pageUrl} ${e.message}\n`);
      }
    }
    process.stderr.write('\n');
  }

  /** @type {object[]} */
  const records = [];

  for (const url of [...pageUrls].sort()) {
    const kind = classifyUrl(url);
    const title = rssTitles.get(url) || '';
    const sug = suggestPagePath(url, rssTitles, newsPosts);
    records.push({
      url,
      kind: kind === 'page' || url.includes('/blog') ? 'page' : kind,
      title_or_label: title,
      discovered_from: 'sitemap_or_rss',
      local_repo_path: '',
      downloaded: kind === 'page' ? 'n/a' : 'n/a',
      migrated: sug.migrated,
      new_site_path: sug.newSitePath,
      notes: sug.notes,
    });
  }

  for (const [url, meta] of [...assetIndex.entries()].sort(([a], [b]) => a.localeCompare(b))) {
    await delay(45);
    const local = await resolveDownloadedPath(url);
    const downloaded = local ? 'yes' : 'no';
    const inRepo =
      downloaded === 'yes' ||
      scanRepoForSubstring(url) ||
      (local ? scanRepoForSubstring(local.replace(/^public\//, '')) : false);
    records.push({
      url,
      kind: meta.kind,
      title_or_label: '',
      discovered_from: [...meta.sources].slice(0, 5).join('; ') + (meta.sources.size > 5 ? '; …' : ''),
      local_repo_path: local,
      downloaded,
      migrated: inRepo ? 'partial' : 'no',
      new_site_path: '',
      notes: meta.sources.size > 5 ? `+${meta.sources.size - 5} more referrers` : '',
    });
  }

  const headers = [
    'url',
    'kind',
    'title_or_label',
    'discovered_from',
    'local_repo_path',
    'downloaded',
    'migrated',
    'new_site_path',
    'notes',
  ];

  const csvLines = [
    headers.join(','),
    ...records.map((r) =>
      headers.map((h) => escapeCsv(r[h])).join(','),
    ),
  ];
  writeFileSync(OUT_CSV, csvLines.join('\n') + '\n', 'utf8');
  writeFileSync(OUT_JSON, JSON.stringify(records, null, 2), 'utf8');

  console.log(`Wrote ${records.length} rows to ${OUT_CSV}`);
  console.log(`Wrote ${OUT_JSON}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
