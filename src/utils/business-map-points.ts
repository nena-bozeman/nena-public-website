/**
 * Pushes apart markers that share the same coordinates (e.g. placeholder geocodes on one street)
 * so each pin is clickable. Does not change single pins.
 */
const GROUP_PRECISION = 5; // ~1.1 m — treat as “same building/corner”

export function spreadOverlappingMapPoints<T extends { lat: number; lng: number }>(
  items: T[],
  radiusMeters = 20,
): T[] {
  if (items.length <= 1) return items.map((i) => ({ ...i }));

  const groups = new Map<string, T[]>();
  for (const item of items) {
    const key = `${item.lat.toFixed(GROUP_PRECISION)},${item.lng.toFixed(GROUP_PRECISION)}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  const out: T[] = [];
  for (const group of groups.values()) {
    if (group.length === 1) {
      out.push({ ...group[0] });
      continue;
    }
    // Deterministic: sort by slug or name if present
    const sorted = [...group].sort((a, b) => {
      const sa = 'slug' in a && typeof (a as { slug?: string }).slug === 'string' ? (a as { slug: string }).slug : '';
      const sb = 'slug' in b && typeof (b as { slug?: string }).slug === 'string' ? (b as { slug: string }).slug : '';
      return sa.localeCompare(sb);
    });
    const n = sorted.length;
    sorted.forEach((p, i) => {
      const angle = (2 * Math.PI * i) / n;
      const lat0 = p.lat;
      const latRad = (lat0 * Math.PI) / 180;
      const dLat = (radiusMeters * Math.sin(angle)) / 111_320;
      const dLng = (radiusMeters * Math.cos(angle)) / (111_320 * Math.cos(latRad));
      out.push({
        ...p,
        lat: lat0 + dLat,
        lng: p.lng + dLng,
      });
    });
  }
  return out;
}
