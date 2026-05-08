import { expandCraftSitePlaceholder } from '../utils/site-base.mjs';

function walk(node, fn) {
  fn(node);
  const kids = node.children;
  if (Array.isArray(kids)) for (const c of kids) walk(c, fn);
}

const STANDALONE_IMG_TEXT_RE = /^!\[([^\]]*)\]\(([^)]+)\)\s*$/;

/**
 * Expands Craft `{{ url:site }}` in markdown AST. Content-collection `.md` is not passed
 * through the Vite pre-transform, so placeholders must run in the remark pipeline.
 *
 * @param {{ siteRoot?: string }} opts
 */
export function remarkExpandCraftSitePlaceholder(opts = {}) {
  const prefix = opts.siteRoot ?? '';
  if (!prefix) {
    return () => {};
  }
  return (tree) => {
    walk(tree, (node) => {
      if (
        (node.type === 'link' || node.type === 'image' || node.type === 'definition') &&
        typeof node.url === 'string'
      ) {
        const next = expandCraftSitePlaceholder(node.url, prefix);
        if (next !== node.url) node.url = next;
        return;
      }
      if (
        node.type === 'paragraph' &&
        node.children?.length === 1 &&
        node.children[0].type === 'text'
      ) {
        const raw = node.children[0].value;
        const m = raw.match(STANDALONE_IMG_TEXT_RE);
        if (!m) return;
        const url = expandCraftSitePlaceholder(m[2], prefix);
        node.children = [{ type: 'image', url, alt: m[1] || '', title: null }];
      }
    });
  };
}

export default remarkExpandCraftSitePlaceholder;
