/**
 * Fans out map pins that would stack, so each one stays clickable.
 * `clusterMeters` is how close two pins must be to share a fan (default ~1 m,
 * the same corner, matching the business directory). A larger value also
 * separates neighbors that are merely nearby. Each group is placed on a ring
 * of `radiusMeters` around the group’s midpoint. Single pins are unchanged.
 */
const METERS_PER_DEGREE_LAT = 111_320;

function metersBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }): number {
  const lat = ((a.lat + b.lat) / 2) * (Math.PI / 180);
  const dy = (a.lat - b.lat) * METERS_PER_DEGREE_LAT;
  const dx = (a.lng - b.lng) * METERS_PER_DEGREE_LAT * Math.cos(lat);
  return Math.hypot(dx, dy);
}

function pinSortKey(point: object): string {
  if ('id' in point && typeof point.id === 'string') return point.id;
  return '';
}

function clusterByDistance<T extends { lat: number; lng: number }>(items: T[], clusterMeters: number): T[][] {
  const parent = items.map((_, index) => index);
  const find = (index: number): number => {
    let current = index;
    while (parent[current] !== current) {
      parent[current] = parent[parent[current]];
      current = parent[current];
    }
    return current;
  };
  const unite = (a: number, b: number) => {
    const rootA = find(a);
    const rootB = find(b);
    if (rootA !== rootB) parent[rootA] = rootB;
  };
  for (let i = 0; i < items.length; i++) {
    for (let j = i + 1; j < items.length; j++) {
      if (metersBetween(items[i], items[j]) <= clusterMeters) unite(i, j);
    }
  }
  const groups = new Map<number, T[]>();
  for (let i = 0; i < items.length; i++) {
    const root = find(i);
    const group = groups.get(root);
    if (group) group.push(items[i]);
    else groups.set(root, [items[i]]);
  }
  return [...groups.values()];
}

function fanAroundMidpoint<T extends { lat: number; lng: number }>(group: T[], radiusMeters: number): T[] {
  if (group.length <= 1) return group.map((point) => ({ ...point }));
  const sorted = [...group].sort((a, b) => pinSortKey(a).localeCompare(pinSortKey(b)));
  const lat0 = sorted.reduce((sum, point) => sum + point.lat, 0) / sorted.length;
  const lng0 = sorted.reduce((sum, point) => sum + point.lng, 0) / sorted.length;
  const latRad = (lat0 * Math.PI) / 180;
  const count = sorted.length;
  return sorted.map((point, index) => {
    const angle = (2 * Math.PI * index) / count;
    const dLat = (radiusMeters * Math.cos(angle)) / METERS_PER_DEGREE_LAT;
    const dLng = (radiusMeters * Math.sin(angle)) / (METERS_PER_DEGREE_LAT * Math.cos(latRad));
    return { ...point, lat: lat0 + dLat, lng: lng0 + dLng };
  });
}

export function spreadOverlappingMapPoints<T extends { lat: number; lng: number }>(
  items: T[],
  radiusMeters = 20,
  clusterMeters = 1.1,
): T[] {
  if (items.length <= 1) return items.map((point) => ({ ...point }));
  return clusterByDistance(items, clusterMeters).flatMap((group) => fanAroundMidpoint(group, radiusMeters));
}
