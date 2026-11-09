/** Shared by the site build and Google Calendar sync. */

export function isDraftEvent(data) {
  return data?.draft === true;
}

/**
 * Production listings omit drafts. Dev keeps them so a reviewer can see the file.
 *
 * @template {{ data?: { draft?: boolean }, draft?: boolean }} T
 * @param {T[]} entries
 * @param {boolean} prod
 * @returns {T[]}
 */
export function eventsVisibleOnSite(entries, prod) {
  if (!prod) return entries;
  return entries.filter((entry) => !isDraftEvent(entry?.data ?? entry));
}
