import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import { computeSiteRootPrefix, normalizeAstroBase } from './src/utils/site-base.mjs';
import { viteExpandCraftSitePlaceholder } from './src/plugins/vite-expand-craft-site-placeholder.mjs';

// GitHub Pages: e.g. `/nena-public-website/`. Cloudflare (root): `/` or ``.
const siteBase = normalizeAstroBase(process.env.ASTRO_BASE_PATH ?? '/nena-public-website/');
const site = 'https://nena-bozeman.github.io';
const siteRootPrefix = computeSiteRootPrefix(site, siteBase);

export default defineConfig({
  site,
  base: siteBase,
  output: 'static',
  integrations: [tailwind()],
  vite: {
    plugins: [viteExpandCraftSitePlaceholder({ siteRoot: siteRootPrefix })],
  },
  markdown: {
    // Use file paths (not function references) so plugins survive Astro content sync serialization.
    remarkPlugins: [['./src/plugins/remark-expand-craft-site-placeholder.mjs', { siteRoot: siteRootPrefix }]],
    rehypePlugins: [
      ['./src/plugins/rehype-expand-url-site-placeholder.mjs', { siteRoot: siteRootPrefix }],
      ['./src/plugins/rehype-site-base-links.mjs', { base: siteBase }],
    ],
  },
});
