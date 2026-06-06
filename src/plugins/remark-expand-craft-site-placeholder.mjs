import { expandCraftSitePlaceholder } from '../utils/site-base.mjs';

function walk(node, fn) {
  fn(node);
  const kids = node.children;
  if (Array.isArray(kids)) for (const c of kids) walk(c, fn);
}

const LEADING_IMG_TEXT_RE = /^!\[([^\]]*)\]\(([^)]+)\)\s*/;

function tryConvertLeadingImageParagraph(node, prefix) {
  const first = node.children?.[0];
  if (first?.type !== 'text') return;
  const m = first.value.match(LEADING_IMG_TEXT_RE);
  if (!m) return;
  const url = expandCraftSitePlaceholder(m[2], prefix);
  const tail = first.value.slice(m[0].length);
  const imageNode = { type: 'image', url, alt: m[1] || '', title: null };
  if (tail.length === 0) {
    node.children[0] = imageNode;
  } else {
    node.children = [imageNode, { type: 'text', value: tail }, ...node.children.slice(1)];
  }
}

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
      if (node.type === 'paragraph') {
        tryConvertLeadingImageParagraph(node, prefix);
      }
      if (
        (node.type === 'link' || node.type === 'image' || node.type === 'definition') &&
        typeof node.url === 'string'
      ) {
        const next = expandCraftSitePlaceholder(node.url, prefix);
        if (next !== node.url) node.url = next;
        return;
      }
      if (node.type === 'text' && typeof node.value === 'string') {
        const next = expandCraftSitePlaceholder(node.value, prefix);
        if (next !== node.value) node.value = next;
      }
    });
  };
}

export default remarkExpandCraftSitePlaceholder;
