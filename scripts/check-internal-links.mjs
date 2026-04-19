#!/usr/bin/env node
/**
 * Scan the static build output for broken internal navigational links.
 *
 * Resolves <a href> and <area href> the same way static hosts do: trailing
 * /index.html, /path/index.html, and /path.html. Uses `base` and `site` from
 * astro.config.mjs so URL paths match the deployed GitHub Pages layout.
 *
 * Usage: npm run build && npm run check:internal-links
 *
 * Flags:
 *   --dir <path>   Root of the static site (default: dist)
 */

import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, dirname, relative, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const ASTRO_CONFIG = join(ROOT, 'astro.config.mjs');
const DEFAULT_DIST = join(ROOT, 'dist');

function readAstroStringField(name) {
  if (!existsSync(ASTRO_CONFIG)) return '';
  const s = readFileSync(ASTRO_CONFIG, 'utf8');
  const re = new RegExp(`${name}:\\s*['"]([^'"]*)['"]`);
  const m = s.match(re);
  return m ? m[1] : '';
}

/** @returns {{ basePath: string, siteOrigin: string | null }} */
function readAstroRouting() {
  const baseRaw = readAstroStringField('base') || '/';
  const baseNorm = '/' + baseRaw.replace(/^\/+|\/+$/g, '');
  const basePath = baseNorm === '/' ? '' : baseNorm;

  const site = readAstroStringField('site');
  let siteOrigin = null;
  if (site) {
    try {
      siteOrigin = new URL(site).origin;
    } catch {
      siteOrigin = null;
    }
  }

  return { basePath, siteOrigin };
}

/** @param {string} relPosix path relative to dist, forward slashes */
function fileRelToDirUrlPath(relPosix, basePath) {
  const prefix = basePath === '/' ? '' : basePath;
  if (relPosix === 'index.html') return prefix + '/';
  if (relPosix.endsWith('/index.html')) {
    const dir = relPosix.slice(0, -'/index.html'.length);
    return `${prefix}/${dir}/`;
  }
  if (relPosix.endsWith('.html')) {
    const noExt = relPosix.slice(0, -'.html'.length);
    return `${prefix}/${noExt}`;
  }
  return prefix + '/';
}

/**
 * @param {string} urlPath pathname only, e.g. /nena-public-website/news
 * @param {string} basePath e.g. /nena-public-website
 */
function stripBase(urlPath, basePath) {
  if (!basePath) return urlPath;
  if (urlPath === basePath || urlPath === basePath + '/') return '/';
  const prefix = basePath.endsWith('/') ? basePath : basePath + '/';
  if (urlPath.startsWith(prefix)) return '/' + urlPath.slice(prefix.length);
  return null;
}

/**
 * @param {string} distRoot
 * @param {string} pathAfterBase posix, leading slash, no query/hash
 */
function targetExistsOnDisk(distRoot, pathAfterBase) {
  let p = pathAfterBase.replace(/\/+$/, '') || '/';
  if (p.startsWith('/')) p = p.slice(1);
  const segments = p ? p.split('/') : [];

  const joined = segments.length ? join(distRoot, ...segments) : distRoot;

  if (existsSync(joined) && statSync(joined).isFile()) return true;
  if (existsSync(join(joined, 'index.html'))) return true;
  if (existsSync(joined + '.html')) return true;
  return false;
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

const HREF_RE = /\bhref\s*=\s*["']([^"'<>]+)["']/gi;

/**
 * @param {string} html
 * @returns {string[]}
 */
function extractHrefs(html) {
  const set = new Set();
  let m;
  HREF_RE.lastIndex = 0;
  while ((m = HREF_RE.exec(html)) !== null) {
    const v = (m[1] || '').trim();
    if (v) set.add(v);
  }
  return [...set];
}

function shouldSkipHref(raw) {
  const h = raw.trim();
  if (!h || h === '#') return true;
  const lower = h.toLowerCase();
  if (lower.startsWith('mailto:')) return true;
  if (lower.startsWith('tel:')) return true;
  if (lower.startsWith('javascript:')) return true;
  if (lower.startsWith('data:')) return true;
  return false;
}

/**
 * @param {string} rawHref
 * @param {string} fromDirUrlPath directory URL path ending in /
 * @param {{ basePath: string, siteOrigin: string | null }} routing
 * @returns {string | null} pathname starting with basePath, or null if not an internal navigational target
 */
function resolveInternalPathname(rawHref, fromDirUrlPath, routing) {
  const { basePath, siteOrigin } = routing;
  const dummy = 'https://link-check.internal';

  let pathname;
  let host = null;

  try {
    if (/^https?:\/\//i.test(rawHref)) {
      const u = new URL(rawHref);
      host = u.host;
      pathname = u.pathname;
    } else {
      const baseForResolve = fromDirUrlPath.endsWith('/')
        ? new URL(fromDirUrlPath, dummy)
        : new URL(fromDirUrlPath + '/', dummy);
      const u = new URL(rawHref, baseForResolve);
      pathname = u.pathname;
    }
  } catch {
    return null;
  }

  if (host && siteOrigin) {
    try {
      const allowed = new URL(siteOrigin).host;
      if (host !== allowed) return null;
    } catch {
      return null;
    }
  } else if (host) {
    return null;
  }

  const noHash = pathname.split('#')[0] || '/';
  const pathOnly = (noHash.split('?')[0] || '/').replace(/\/+/g, '/');

  if (basePath) {
    if (pathOnly === basePath || pathOnly.startsWith(basePath + '/') || pathOnly + '/' === basePath + '/') {
      return pathOnly;
    }
    if (!host && !/^https?:\/\//i.test(rawHref)) {
      const stripped = stripBase(pathOnly, basePath);
      if (stripped !== null) return basePath + (stripped === '/' ? '' : stripped);
    }
    return null;
  }

  if (!host && !/^https?:\/\//i.test(rawHref)) {
    return pathOnly.startsWith('/') ? pathOnly : null;
  }

  if (!basePath && pathOnly.startsWith('/')) return pathOnly;
  return null;
}

function parseArgs(argv) {
  let dir = DEFAULT_DIST;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--dir' && argv[i + 1]) {
      dir = join(ROOT, argv[++i]);
    }
  }
  return { dir };
}

function main() {
  const { dir: distRoot } = parseArgs(process.argv.slice(2));
  const routing = readAstroRouting();

  if (!existsSync(distRoot)) {
    console.error(`Missing build output: ${distRoot}\nRun: npm run build`);
    process.exit(1);
  }

  const htmlFiles = walkHtmlFiles(distRoot);
  const broken = [];

  for (const abs of htmlFiles) {
    const rel = relative(distRoot, abs).split(sep).join('/');
    const fromDirUrlPath = fileRelToDirUrlPath(rel, routing.basePath);
    const html = readFileSync(abs, 'utf8');

    for (const href of extractHrefs(html)) {
      if (shouldSkipHref(href)) continue;
      if (href.startsWith('#')) continue;

      const pathname = resolveInternalPathname(href, fromDirUrlPath, routing);
      if (!pathname) continue;

      const afterBase = routing.basePath
        ? stripBase(pathname, routing.basePath)
        : pathname;
      if (afterBase === null) continue;

      const posix = afterBase.startsWith('/') ? afterBase : '/' + afterBase;
      if (!targetExistsOnDisk(distRoot, decodeURI(posix))) {
        broken.push({ from: rel, href, resolved: pathname });
      }
    }
  }

  if (broken.length) {
    console.error(`Broken internal links (${broken.length}):\n`);
    for (const b of broken) {
      console.error(`  from: ${b.from}\n  href: ${b.href}\n  path: ${b.resolved}\n`);
    }
    process.exit(1);
  }

  console.log(`OK — checked internal links in ${htmlFiles.length} HTML file(s) under ${relative(ROOT, distRoot) || '.'}`);
}

main();
