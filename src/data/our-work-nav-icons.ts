import type { NavIconName } from './nav-icons';

/**
 * Lucide icon for each objective page, keyed by content slug.
 * Listed objectives are omitted from the Our Work nav until they have an entry here.
 */
export const ourWorkObjectiveIcons: Record<string, NavIconName> = {
  'affordable-housing': 'house-plus',
  'bozeman-creek-vision-plan': 'waves-horizontal',
  'bozeman-udc': 'scale',
  'burdock-blitz': 'sprout',
  'inter-neighborhood-council': 'users',
  'ncod-guidelines': 'landmark',
  'nena-meetings': 'calendar',
  'nena-newsletters': 'newspaper',
  'nena-survey': 'clipboard-list',
  'northeast-urban-renewal-district': 'land-plot',
  'parade-of-sheds': 'warehouse',
  'safe-quiet-rail-crossings': 'train-front',
  'traffic-calming': 'car-front',
  'trails-pocket-parks': 'footprints',
  trees: 'tree-deciduous',
  visionne: 'compass',
};
