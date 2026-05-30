/** Listing visibility shared by objectives, businesses, development, etc. */

export const LIST_STATUS_VALUES = ['current', 'past'] as const;

export type ListStatus = (typeof LIST_STATUS_VALUES)[number];

export const LIST_STATUS_LABELS: Record<ListStatus, string> = {
  current: 'Current',
  past: 'Past',
};

/** URL path segment for the past listing (static-friendly; query params are not prerendered). */
export const LIST_STATUS_PAST_SEGMENT = 'past';

export const LIST_STATUS_QUERY = 'status';

export function parseListStatusFromSearch(search: string): ListStatus {
  const raw = new URLSearchParams(search).get(LIST_STATUS_QUERY);
  if (raw === 'past') return 'past';
  if (raw === 'current') return 'current';
  const legacyPeriod = new URLSearchParams(search).get('period');
  if (legacyPeriod === 'past') return 'past';
  if (legacyPeriod === 'current') return 'current';
  return 'current';
}

/**
 * Past filter lives at `/{pagePath}/past` so static builds emit separate HTML.
 * `pathname` is the request path (e.g. `/nena-public-website/businesses/past`).
 */
export function parseListStatusFromPathname(pathname: string, baseUrl: string): ListStatus {
  const base = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
  let rel = pathname;
  if (base && rel.startsWith(base)) {
    rel = rel.slice(base.length) || '/';
  }
  const normalized = rel.replace(/\/+$/, '') || '/';
  const pageRoots = ['objectives', 'businesses'] as const;
  for (const root of pageRoots) {
    if (normalized === `/${root}/${LIST_STATUS_PAST_SEGMENT}`) {
      return 'past';
    }
  }
  return 'current';
}

export function parseListStatus(pathname: string, search: string, baseUrl: string): ListStatus {
  const fromPath = parseListStatusFromPathname(pathname, baseUrl);
  if (fromPath === 'past') return 'past';
  return parseListStatusFromSearch(search);
}

export function matchesListStatus(itemStatus: ListStatus, filter: ListStatus): boolean {
  return itemStatus === filter;
}

/**
 * Link for a list index. Past uses `/{pagePath}/past`; current uses the hub path.
 * `pagePath` is relative to site root, e.g. `objectives`.
 */
export function listStatusHref(
  pagePath: string,
  status: ListStatus,
  baseUrl: string,
): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const path = pagePath.replace(/^\//, '').replace(/\/$/, '');
  const hub = path ? `${base}${path}` : base.replace(/\/$/, '');
  if (status === 'past') {
    return `${hub}/${LIST_STATUS_PAST_SEGMENT}`;
  }
  return hub;
}

export function listStatusLabel(status: ListStatus): string {
  return LIST_STATUS_LABELS[status];
}

export function allListStatuses(): readonly ListStatus[] {
  return LIST_STATUS_VALUES;
}
