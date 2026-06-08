/**
 * Map public URLs to Decap CMS edit links.
 * Section hub slugs must stay in sync with OUR_WORK_SECTION_CONFIG in src/data/our-work.ts.
 */

import { CMS_PAGE_SLUGS } from './page-sections.mjs';

/** @typedef {{ collection: string; entryId: string }} CmsEditTarget */

const OUR_WORK_PATH = 'our-work';
const LIST_STATUS_PAST_SEGMENT = 'past';

const CMS_CONTENT_COLLECTIONS = new Set(['news', 'events', 'places', 'development', 'history', 'pages']);
const PLACES_LIST_SEGMENTS = new Set(['past', 'archive', 'table']);
const OUR_WORK_SECTION_HUB_SLUGS = new Set([
  'neighborhood-communication',
  'neighborhood-advocacy',
]);

/** @param {string} pathname @param {string} [base] */
export function stripSiteBaseFromPathname(pathname, base = '/') {
  let path = pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  const normalizedBase = base.endsWith('/') ? base.slice(0, -1) : base;
  if (normalizedBase && normalizedBase !== '/' && path.startsWith(normalizedBase)) {
    path = path.slice(normalizedBase.length) || '/';
  }
  return path;
}

/** @param {string} pathname @param {string} [base] @returns {CmsEditTarget | null} */
export function cmsEditTargetFromPathname(pathname, base = '/') {
  const path = stripSiteBaseFromPathname(pathname, base);
  const segments = path.split('/').filter(Boolean);
  if (segments.length === 0) return null;

  const [first, second, third] = segments;

  if (segments.length === 1 && CMS_PAGE_SLUGS.includes(first)) {
    return { collection: 'pages', entryId: first };
  }

  if (CMS_CONTENT_COLLECTIONS.has(first) && segments.length === 2) {
    if (first === 'places' && PLACES_LIST_SEGMENTS.has(second)) {
      return null;
    }
    return { collection: first, entryId: second };
  }

  if (first === OUR_WORK_PATH) {
    if (second === 'nena-meetings' && third) {
      return { collection: 'meetings', entryId: third };
    }
    if (second === 'nena-meetings' && segments.length === 2) {
      return { collection: 'objectives', entryId: 'nena-meetings' };
    }
    if (
      second &&
      segments.length === 2 &&
      second !== LIST_STATUS_PAST_SEGMENT &&
      !OUR_WORK_SECTION_HUB_SLUGS.has(second)
    ) {
      return { collection: 'objectives', entryId: second };
    }
  }

  return null;
}

/** @param {string} _base @param {CmsEditTarget} target */
export function cmsEditHref(_base, target) {
  const { collection, entryId } = target;
  return `admin/#/collections/${collection}/entries/${encodeURIComponent(entryId)}`;
}

/** @param {string} pathname @param {string} [base] @returns {string | null} */
export function cmsEditHrefForPathname(pathname, base = '/') {
  const target = cmsEditTargetFromPathname(pathname, base);
  return target ? cmsEditHref(base, target) : null;
}
