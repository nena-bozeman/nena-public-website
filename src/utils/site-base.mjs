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
