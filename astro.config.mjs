import { defineConfig } from 'astro/config';
import tailwind from '@astrojs/tailwind';

export default defineConfig({
  site: 'https://nena-bozeman.github.io',
  base: '/nena-public-website',
  output: 'static',
  integrations: [tailwind()],
});
