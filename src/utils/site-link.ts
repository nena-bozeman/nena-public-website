import { applySiteBaseToPathname } from './site-base.mjs';

/**
 * Internal navigation URL: use a site-root path such as `/events` or `/about`.
 * Respects `import.meta.env.BASE_URL` (GitHub Pages subpath vs root deploy).
 */
export function withSiteBase(pathname: string): string {
  return applySiteBaseToPathname(pathname, import.meta.env.BASE_URL);
}
