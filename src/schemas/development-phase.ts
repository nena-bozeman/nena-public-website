/** City / project workflow stage (separate from listing `status`). */

export const DEVELOPMENT_PHASE_VALUES = [
  'proposed',
  'under-review',
  'approved',
  'under-construction',
  'complete',
  'denied',
] as const;

export type DevelopmentPhase = (typeof DEVELOPMENT_PHASE_VALUES)[number];

export const DEVELOPMENT_PHASE_LABELS: Record<DevelopmentPhase, string> = {
  proposed: 'Proposed',
  'under-review': 'Under Review',
  approved: 'Approved',
  'under-construction': 'Under Construction',
  complete: 'Complete',
  denied: 'Denied',
};

export const DEVELOPMENT_PHASE_QUERY = 'phase';

export function parseDevelopmentPhaseFromSearch(
  search: string,
): DevelopmentPhase | null {
  const raw = new URLSearchParams(search).get(DEVELOPMENT_PHASE_QUERY);
  if (!raw) return null;
  return DEVELOPMENT_PHASE_VALUES.includes(raw as DevelopmentPhase)
    ? (raw as DevelopmentPhase)
    : null;
}

export function developmentPhaseHref(
  phase: DevelopmentPhase | null,
  baseUrl: string,
): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const hub = `${base}development`;
  if (!phase) return hub;
  return `${hub}?${DEVELOPMENT_PHASE_QUERY}=${phase}`;
}

export const DEVELOPMENT_PHASE_BADGE: Record<DevelopmentPhase, { color: string; label: string }> =
  Object.fromEntries(
    DEVELOPMENT_PHASE_VALUES.map((phase) => [
      phase,
      {
        color:
          phase === 'proposed'
            ? 'bg-yellow-100 text-yellow-800'
            : phase === 'under-review'
              ? 'bg-orange-100 text-orange-800'
              : phase === 'approved'
                ? 'bg-green-100 text-green-800'
                : phase === 'under-construction'
                  ? 'bg-blue-100 text-blue-800'
                  : phase === 'complete'
                    ? 'bg-gray-100 text-gray-800'
                    : 'bg-red-100 text-red-800',
        label: DEVELOPMENT_PHASE_LABELS[phase],
      },
    ]),
  ) as Record<DevelopmentPhase, { color: string; label: string }>;
