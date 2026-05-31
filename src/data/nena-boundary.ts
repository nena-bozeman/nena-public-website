/** Fill/stroke sampled from the legacy nena-map.png boundary overlay. */
export const nenaBoundaryStyle = {
  fill: '#b1e5f1',
  fillOpacity: 0.5,
  stroke: '#6ab4cc',
  strokeOpacity: 0.85,
} as const;

/** Lat/lng ring for NENA neighborhood boundaries (bylaws + geocoded street intersections). */
export const nenaBoundaryDescription =
  'NENA covers the area bounded by East Oak Street on the north, Mendenhall Street on the south, North Grand Avenue on the west, and North Broadway Street, Front Street, and the railroad on the east.';

/**
 * Clockwise from northwest corner. West edge follows North Willson Ave to match the
 * legacy boundary map; south and north edges follow Mendenhall and East Oak St;
 * east edge follows the railroad corridor from Oak/Rouse to Mendenhall/Wallace.
 */
export const nenaBoundaryRing: { lat: number; lng: number }[] = [
  { lat: 45.6934, lng: -111.0405 }, // 1. NW — E Oak St & N Grand Ave
  { lat: 45.6934, lng: -111.0315 }, // 2. NE — E Oak St meets the railroad (~N Rouse Ave)
  { lat: 45.6860, lng: -111.0235 }, // 3. E  — railroad / Front St reaches N Broadway St
  { lat: 45.6803, lng: -111.0257 }, // 4. SE — N Broadway St & E Mendenhall St
  { lat: 45.6803, lng: -111.0405 }, // 5. SW — E Mendenhall St & N Grand Ave
];
