import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import { normalizeAstroBase } from './src/utils/site-base.mjs';
import { rehypeSiteBaseLinks } from './src/plugins/rehype-site-base-links.mjs';

// GitHub Pages: e.g. `/nena-public-website/`. Cloudflare (root): `/` or ``.
const siteBase = normalizeAstroBase(process.env.ASTRO_BASE_PATH ?? '/nena-public-website/');

export default defineConfig({
  site: 'https://nena-bozeman.github.io',
  base: siteBase,
  output: 'static',
  integrations: [tailwind()],
  markdown: {
    rehypePlugins: [[rehypeSiteBaseLinks, { base: siteBase }]],
  },
});
