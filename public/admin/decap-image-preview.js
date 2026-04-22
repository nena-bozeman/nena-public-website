/**
 * Decap renders markdown preview in the browser with root-absolute `/images/...` URLs.
 * When the site uses Astro `base` (e.g. /nena-public-website/), those break unless
 * prefixed — same as rehype-site-base-links. Mirror applySiteBaseToPathname from
 * src/utils/site-base.mjs (keep in sync).
 */
(function () {
  const baseRaw = (window.__NENA_CMS_BASE__ || '/').trim() || '/';
  let b = baseRaw.startsWith('/') ? baseRaw : `/${baseRaw}`;
  if (b !== '/' && !b.endsWith('/')) b += '/';

  function applySiteBaseToPathname(pathname) {
    const p = typeof pathname === 'string' ? pathname.trim() : '';
    if (!p.startsWith('/') || p.startsWith('//')) return p;
    const base = b;
    const basePath = base === '/' ? '' : base.replace(/\/$/, '');
    if (!basePath) return p;
    if (p === basePath || p.startsWith(`${basePath}/`)) return p;
    return `${basePath}${p}`;
  }

  function fixAll() {
    document
      .querySelectorAll('img[src], video[src], source[src]')
      .forEach((el) => {
        const src = el.getAttribute('src');
        if (typeof src !== 'string') return;
        const next = applySiteBaseToPathname(src);
        if (next !== src) el.setAttribute('src', next);
      });
  }

  let t;
  function schedule() {
    fixAll();
    clearTimeout(t);
    t = setTimeout(fixAll, 0);
  }

  fixAll();
  const root = document.documentElement;
  const obs = new MutationObserver(schedule);
  obs.observe(root, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ['src'],
  });
})();
