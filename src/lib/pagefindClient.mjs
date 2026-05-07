/**
 * Pagefind’s browser bundle is emitted only after `pagefind --site dist`; the dynamic import
 * path is resolved at runtime from `import.meta.env.BASE_URL`.
 * @param {string} baseUrl
 */
export async function loadPagefind(baseUrl) {
  // Avoid Vite's dynamic-import preload transform for runtime-computed URLs.
  const runtimeImport = new Function('u', 'return import(u)');
  const pagefind = await runtimeImport(`${baseUrl}pagefind/pagefind.js`);
  // Pagefind 1.5 uses `basePath` (trailing slash). `bundlePath` is ignored and logs a warning.
  await pagefind.options({ basePath: `${baseUrl}pagefind/` });
  return pagefind;
}

/**
 * Pagefind result URLs are root paths like `/about/`; with Astro `base` they need the subpath
 * (e.g. GitHub Pages) but must not be doubled.
 * @param {string} href
 * @param {string} baseWithSlash
 */
export function hrefWithBase(href, baseWithSlash) {
  if (!href) {
    return '#';
  }
  if (/^https?:\/\//i.test(href) || href.startsWith('//')) {
    return href;
  }
  if (baseWithSlash === '/' || !baseWithSlash) {
    return href.startsWith('/') ? href : `/${href}`;
  }
  const root = baseWithSlash.endsWith('/')
    ? baseWithSlash.slice(0, -1)
    : baseWithSlash;
  if (href === root || href.startsWith(`${root}/`)) {
    return href;
  }
  if (href.startsWith('/')) {
    return `${root}${href}`;
  }
  return `${root}/${href.replace(/^\.\//, '')}`;
}
