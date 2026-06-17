import { defineConfig } from 'astro/config';
import { unified } from '@astrojs/markdown-remark';
import tailwindcss from '@tailwindcss/vite';
import { computeSiteRootPrefix, normalizeAstroBase } from './src/utils/site-base.mjs';
import { remarkExpandCraftSitePlaceholder } from './src/plugins/remark-expand-craft-site-placeholder.mjs';
import { rehypeExpandUrlSitePlaceholder } from './src/plugins/rehype-expand-url-site-placeholder.mjs';
import { rehypeSiteBaseLinks } from './src/plugins/rehype-site-base-links.mjs';
import { viteExpandCraftSitePlaceholder } from './src/plugins/vite-expand-craft-site-placeholder.mjs';

// Root-hosted on Cloudflare Workers at nenabozeman.org. Override ASTRO_SITE for local preview or workers.dev debugging.
const siteBase = normalizeAstroBase(process.env.ASTRO_BASE_PATH ?? '/');
const site = process.env.ASTRO_SITE ?? 'https://nenabozeman.org';
const siteRootPrefix = computeSiteRootPrefix(site, siteBase);

export default defineConfig({
  site,
  base: siteBase,
  output: 'static',
  vite: {
    plugins: [
      tailwindcss(),
      viteExpandCraftSitePlaceholder({ siteRoot: siteRootPrefix }),
    ],
  },
  markdown: {
    processor: unified({
      remarkPlugins: [[remarkExpandCraftSitePlaceholder, { siteRoot: siteRootPrefix }]],
      rehypePlugins: [
        [rehypeExpandUrlSitePlaceholder, { siteRoot: siteRootPrefix }],
        [rehypeSiteBaseLinks, { base: siteBase }],
      ],
    }),
  },
});
