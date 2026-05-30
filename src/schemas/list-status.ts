/** Listing visibility shared by objectives, businesses, development, etc. */

export const LIST_STATUS_VALUES = ['current', 'past'] as const;

export type ListStatus = (typeof LIST_STATUS_VALUES)[number];

export const LIST_STATUS_LABELS: Record<ListStatus, string> = {
  current: 'Current',
  past: 'Past',
};

export const LIST_STATUS_QUERY = 'status';

export function parseListStatus(search: string): ListStatus {
  const raw = new URLSearchParams(search).get(LIST_STATUS_QUERY);
  if (raw === 'past') return 'past';
  if (raw === 'current') return 'current';
  /** @deprecated Use `?status=`; `?period=` kept for older links */
  const legacyPeriod = new URLSearchParams(search).get('period');
  if (legacyPeriod === 'past') return 'past';
  if (legacyPeriod === 'current') return 'current';
  return 'current';
}

export function matchesListStatus(itemStatus: ListStatus, filter: ListStatus): boolean {
  return itemStatus === filter;
}

/**
 * Link for a list index. Past uses `?status=past`; current uses a clean URL.
 * `pagePath` is relative to site root, e.g. `objectives`.
 */
export function listStatusHref(
  pagePath: string,
  status: ListStatus,
  baseUrl: string,
): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const path = pagePath.replace(/^\//, '').replace(/\/$/, '');
  const href = path ? `${base}${path}` : base.replace(/\/$/, '');
  if (status === 'past') {
    return `${href}?${LIST_STATUS_QUERY}=past`;
  }
  return href;
}

export function listStatusLabel(status: ListStatus): string {
  return LIST_STATUS_LABELS[status];
}

export function allListStatuses(): readonly ListStatus[] {
  return LIST_STATUS_VALUES;
}
