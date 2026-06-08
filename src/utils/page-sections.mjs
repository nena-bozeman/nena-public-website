/** Split page markdown on `<!-- @section name -->` markers for dynamic blocks. */
export const PAGE_SECTION_MARKER = /<!--\s*@section\s+([\w-]+)\s*-->/g;

/** @typedef {{ type: 'markdown', content: string } | { type: 'section', name: string }} PageBodySegment */

/** @param {string} body @returns {PageBodySegment[]} */
export function splitPageBody(body) {
  if (!body.trim()) return [];

  /** @type {PageBodySegment[]} */
  const segments = [];
  let lastIndex = 0;

  for (const match of body.matchAll(PAGE_SECTION_MARKER)) {
    const index = match.index ?? 0;
    if (index > lastIndex) {
      segments.push({ type: 'markdown', content: body.slice(lastIndex, index) });
    }
    segments.push({ type: 'section', name: match[1] });
    lastIndex = index + match[0].length;
  }

  if (lastIndex < body.length) {
    segments.push({ type: 'markdown', content: body.slice(lastIndex) });
  }

  return segments;
}

/** Slugs with a matching `/slug` route backed by `src/content/pages/{slug}.md`. */
export const CMS_PAGE_SLUGS = ['about', 'governance', 'contact', 'donate', 'community'];
