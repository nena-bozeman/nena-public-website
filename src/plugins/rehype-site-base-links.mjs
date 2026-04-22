import { applySiteBaseToPathname } from '../utils/site-base.mjs';

function walk(node, fn) {
  fn(node);
  const kids = node.children;
  if (Array.isArray(kids)) for (const c of kids) walk(c, fn);
}

function rewriteUrlProperty(node, key, base) {
  const val = node.properties?.[key];
  if (typeof val !== 'string') return;
  const next = applySiteBaseToPathname(val, base);
  if (next !== val) node.properties[key] = next;
}

/**
 * Prefix root-absolute URLs with Astro `base` when missing (e.g. GitHub Pages subpath).
 * Handles links, images, and media so markdown can use paths like `(/events)` and
 * `![](/images/...)` without the deploy prefix in source.
 */
export function rehypeSiteBaseLinks(opts = {}) {
  const base = opts.base ?? '/';
  return (tree) => {
    walk(tree, (node) => {
      if (node.type !== 'element') return;
      const tag = node.tagName;
      if (tag === 'a' || tag === 'area') rewriteUrlProperty(node, 'href', base);
      if (tag === 'img' || tag === 'video' || tag === 'source') rewriteUrlProperty(node, 'src', base);
    });
  };
}

/** Default export so this can be referenced as a string path in `markdown.rehypePlugins` (survives content pipeline serialization). */
export default rehypeSiteBaseLinks;
