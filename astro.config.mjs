import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';
import { normalizeAstroBase } from './src/utils/site-base.mjs';

// GitHub Pages: e.g. `/nena-public-website/`. Cloudflare (root): `/` or ``.
const siteBase = normalizeAstroBase(process.env.ASTRO_BASE_PATH ?? '/nena-public-website/');

export default defineConfig({
  site: 'https://nena-bozeman.github.io',
  base: siteBase,
  output: 'static',
  integrations: [tailwind()],
  markdown: {
    // Use a file path (not a function reference) so the plugin survives Astro content sync
    // serialization; see node_modules/.astro digest: rehypePlugins must not be `null`.
    rehypePlugins: [['./src/plugins/rehype-site-base-links.mjs', { base: siteBase }]],
  },
});
