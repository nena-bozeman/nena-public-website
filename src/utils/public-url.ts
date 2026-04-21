import { applySiteBaseToPathname } from './site-base.mjs';

/** Public asset path under `public/` → URL pathname including Astro `base`. */
export function publicFileUrl(pathFromPublicRoot: string): string {
  const normalized = pathFromPublicRoot.replace(/^\/+/, '');
  const encodedPath =
    '/' + normalized.split('/').filter(Boolean).map(encodeURIComponent).join('/');
  return applySiteBaseToPathname(encodedPath, import.meta.env.BASE_URL);
}
