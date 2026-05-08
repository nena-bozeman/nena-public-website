/**
 * Replace Craft `{{ url:site }}` in `.md` sources before Markdown parses.
 * Ensures `![]({{ url:site }}files/...)` becomes a real image/link and matches deploy base + site.
 */

const CRAFT_SITE_PLACEHOLDER_RE = /\{\{\s*url:site\s*\}\}/g;

/** @param {{ siteRoot: string }} opts */
export function viteExpandCraftSitePlaceholder(opts = {}) {
  const prefix = opts.siteRoot ?? '';
  if (!prefix) {
    return { name: 'expand-craft-site-placeholder', enforce: 'pre' };
  }
  return {
    name: 'expand-craft-site-placeholder',
    enforce: 'pre',
    transform(code, id) {
      if (!id.includes('/src/') || !id.endsWith('.md')) return null;
      if (!code.includes('{{')) return null;
      const next = code.replace(CRAFT_SITE_PLACEHOLDER_RE, prefix);
      if (next === code) return null;
      return { code: next, map: null };
    },
  };
}
