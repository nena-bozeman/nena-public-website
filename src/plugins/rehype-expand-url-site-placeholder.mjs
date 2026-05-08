import { expandCraftSitePlaceholder } from '../utils/site-base.mjs';

function walk(node, fn) {
  fn(node);
  const kids = node.children;
  if (Array.isArray(kids)) for (const c of kids) walk(c, fn);
}

const URL_ATTRS = ['href', 'src', 'poster', 'data-src', 'cite'];

/**
 * Expands Craft CMS `{{ url:site }}` to the configured deployment root (Astro `site` + `base`).
 * Runs before `rehype-site-base-links` so expanded absolute URLs are left unchanged by base rewriting.
 *
 * @param {{ siteRoot?: string }} opts
 */
export function rehypeExpandUrlSitePlaceholder(opts = {}) {
  const prefix = opts.siteRoot ?? '';
  if (!prefix) {
    return (tree) => tree;
  }
  return (tree) => {
    walk(tree, (node) => {
      if (node.type !== 'element' || !node.properties) return;
      for (const key of URL_ATTRS) {
        const val = node.properties[key];
        if (typeof val !== 'string') continue;
        const next = expandCraftSitePlaceholder(val, prefix);
        if (next !== val) node.properties[key] = next;
      }
    });
  };
}

export default rehypeExpandUrlSitePlaceholder;
