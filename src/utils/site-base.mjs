/**
 * Shared Astro `base` handling for GitHub Pages (subpath) vs Cloudflare (root).
 * Set `ASTRO_BASE_PATH` at build time, e.g. `/` or `/nena-public-website/`.
 */

/** @param {unknown} input */
export function normalizeAstroBase(input) {
  const raw = String(input ?? '/').trim() || '/';
  let b = raw.startsWith('/') ? raw : `/${raw}`;
  if (b !== '/' && !b.endsWith('/')) b += '/';
  return b;
}

/**
 * Prefix a site-root pathname with the configured base when needed.
 * Use paths like `/events` or `/about` in markdown — not the deploy prefix.
 *
 * @param {string} pathname - begins with `/`, not `//`
 * @param {string} baseWithSlash - Astro `import.meta.env.BASE_URL` or config `base`
 */
export function applySiteBaseToPathname(pathname, baseWithSlash) {
  const p = typeof pathname === 'string' ? pathname.trim() : '';
  if (!p.startsWith('/') || p.startsWith('//')) return p;
  const base = normalizeAstroBase(baseWithSlash);
  const basePath = base === '/' ? '' : base.replace(/\/$/, '');
  if (!basePath) return p;
  if (p === basePath || p.startsWith(`${basePath}/`)) return p;
  return `${basePath}${p}`;
}

const CRAFT_SITE_PLACEHOLDER_RE = /\{\{\s*url:site\s*\}\}/g;

/**
 * Absolute URL for the deployed site root with trailing slash.
 * Replaces Craft CMS `{{ url:site }}` in migrated markdown at build time.
 *
 * @param {string} siteStr - `site` from astro.config (origin only is used)
 * @param {string} baseWithSlash - Astro `base`
 */
export function computeSiteRootPrefix(siteStr, baseWithSlash) {
  const u = new URL(siteStr);
  const base = normalizeAstroBase(baseWithSlash);
  const basePath = base === '/' ? '' : base.replace(/\/$/, '');
  return `${u.origin}${basePath}/`;
}

/**
 * Expand Craft `{{ url:site }}` in a string (href, src, etc.).
 *
 * @param {string} value
 * @param {string} siteRootPrefix - from {@link computeSiteRootPrefix}
 */
export function expandCraftSitePlaceholder(value, siteRootPrefix) {
  if (typeof value !== 'string') return value;
  let s = value;
  if (value.includes('%7B%7B')) {
    try {
      s = decodeURIComponent(value);
    } catch {
      s = value;
    }
  }
  if (!s.includes('{{')) return value;
  return s.replace(CRAFT_SITE_PLACEHOLDER_RE, siteRootPrefix);
}
