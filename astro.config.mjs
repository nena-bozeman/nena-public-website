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
    // Use a file path (not a function reference) so the plugin survives Astro content sync
    // serialization; see node_modules/.astro digest: rehypePlugins must not be `null`.
    rehypePlugins: [['./src/plugins/rehype-site-base-links.mjs', { base: siteBase }]],
  },
});
