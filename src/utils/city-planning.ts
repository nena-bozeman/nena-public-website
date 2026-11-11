/** City of Bozeman Planning Projects viewer. Opens the map without a file selected. */
export const PLANNING_MAP_URL = 'https://gisweb.bozeman.net/Html5Viewer/?viewer=planning';

/**
 * Community Development viewer FAQs, linked from the planning map.
 * The city's notice for application 24281 also sends people here for project documents.
 */
export const PLANNING_PORTAL_URL =
  'https://www.bozeman.net/departments/community-development/planning/project-information-portal';

/** Address shown on the planning map. */
export const PLANNING_EMAIL = 'planning@bozeman.net';

/**
 * Deep link the planning viewer uses to open one application.
 * Verified against the live viewer: `FILE_NUMBER` queries the active planning layer
 * and opens that application's result. Closed applications are not in that layer.
 */
export function planningFileMapUrl(fileNumber: string): string {
  const url = new URL(PLANNING_MAP_URL);
  url.searchParams.set('FILE_NUMBER', fileNumber);
  return url.toString();
}
