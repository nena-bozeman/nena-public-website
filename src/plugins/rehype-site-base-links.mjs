import { applySiteBaseToPathname } from '../utils/site-base.mjs';

function walk(node, fn) {
  fn(node);
  const kids = node.children;
  if (Array.isArray(kids)) for (const c of kids) walk(c, fn);
}

/**
 * Prefix root-absolute `href` values on `a` / `area` with Astro `base` when missing.
 * Lets authors write `[Events](/events)` in markdown for any deploy base.
 */
export function rehypeSiteBaseLinks(opts = {}) {
  const base = opts.base ?? '/';
  return (tree) => {
    walk(tree, (node) => {
      if (node.type !== 'element') return;
      if (node.tagName !== 'a' && node.tagName !== 'area') return;
      const href = node.properties?.href;
      if (typeof href !== 'string') return;
      const next = applySiteBaseToPathname(href, base);
      if (next !== href) node.properties.href = next;
    });
  };
}
