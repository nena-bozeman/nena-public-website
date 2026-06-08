import { createMarkdownProcessor } from '@astrojs/markdown-remark';
import { remarkExpandCraftSitePlaceholder } from '../plugins/remark-expand-craft-site-placeholder.mjs';
import { rehypeExpandUrlSitePlaceholder } from '../plugins/rehype-expand-url-site-placeholder.mjs';
import { rehypeSiteBaseLinks } from '../plugins/rehype-site-base-links.mjs';
import { computeSiteRootPrefix, normalizeAstroBase } from './site-base.mjs';

const siteBase = normalizeAstroBase(process.env.ASTRO_BASE_PATH ?? '/');
const site = process.env.ASTRO_SITE ?? 'https://nena-public-website.nenabozeman.workers.dev';
const siteRootPrefix = computeSiteRootPrefix(site, siteBase);

/** @type {Promise<import('@astrojs/internal-helpers/markdown').MarkdownRenderer> | null} */
let processorPromise = null;

function getProcessor() {
  if (!processorPromise) {
    processorPromise = createMarkdownProcessor({
      remarkPlugins: [[remarkExpandCraftSitePlaceholder, { siteRoot: siteRootPrefix }]],
      rehypePlugins: [
        [rehypeExpandUrlSitePlaceholder, { siteRoot: siteRootPrefix }],
        [rehypeSiteBaseLinks, { base: siteBase }],
      ],
    });
  }
  return processorPromise;
}

/** @param {string} source */
export async function renderMarkdownChunk(source) {
  const trimmed = source.trim();
  if (!trimmed) return '';

  const processor = await getProcessor();
  const { code } = await processor.render(trimmed);
  return code;
}
