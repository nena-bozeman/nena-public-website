/** Lucide icon names rendered by `NavIcon.astro`. Add a name here and a component there together. */
export const NAV_ICON_NAMES = [
  'building',
  'calendar',
  'car-front',
  'clipboard-list',
  'compass',
  'eye',
  'footprints',
  'house-plus',
  'landmark',
  'land-plot',
  'megaphone',
  'messages-square',
  'newspaper',
  'scale',
  'sprout',
  'train-front',
  'tree-deciduous',
  'users',
  'warehouse',
  'waves-horizontal',
] as const;

export type NavIconName = (typeof NAV_ICON_NAMES)[number];
