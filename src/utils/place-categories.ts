import {
  BUSINESS_CATEGORY_VALUES,
  type BusinessCategory,
  businessCategoryBadgeClass,
  businessCategoryLabels,
  businessCategoryMarker,
} from './business-categories';
import { TOPIC_LABELS } from '../schemas/topics';

/** Re-exports business category helpers for the unified Places collection. */
export {
  BUSINESS_CATEGORY_VALUES as PLACE_BUSINESS_CATEGORY_VALUES,
  type BusinessCategory as PlaceBusinessCategory,
  businessCategoryLabels as placeBusinessCategoryLabels,
  businessCategoryBadgeClass as placeBusinessCategoryBadgeClass,
  businessCategoryMarker as placeBusinessCategoryMarker,
  businessPrimaryCategory as placePrimaryBusinessCategory,
  formatBusinessCategoryLabels as formatPlaceBusinessCategoryLabels,
} from './business-categories';

/** Categories used by parks and landmarks (not business types). */
export const PLACE_ONLY_CATEGORY_VALUES = ['trails-pocket-parks'] as const;
export type PlaceOnlyCategory = (typeof PLACE_ONLY_CATEGORY_VALUES)[number];

export const PLACE_CATEGORY_VALUES = [
  ...BUSINESS_CATEGORY_VALUES,
  ...PLACE_ONLY_CATEGORY_VALUES,
] as const;
export type PlaceCategory = (typeof PLACE_CATEGORY_VALUES)[number];

export const placeCategoryLabels: Record<PlaceCategory, string> = {
  ...(businessCategoryLabels as Record<BusinessCategory, string>),
  'trails-pocket-parks': TOPIC_LABELS['trails-pocket-parks'],
};

export const placeCategoryBadgeClass: Record<PlaceCategory, string> = {
  ...(businessCategoryBadgeClass as Record<BusinessCategory, string>),
  'trails-pocket-parks': 'bg-green-100 text-green-800',
};

export const placeCategoryMarker: Record<
  PlaceCategory,
  { fill: string; stroke: string }
> = {
  ...(businessCategoryMarker as Record<BusinessCategory, { fill: string; stroke: string }>),
  'trails-pocket-parks': { fill: '#15803d', stroke: '#f0fdf4' },
};

export function placeHasCategory(
  categories: readonly PlaceCategory[],
  category: PlaceCategory,
): boolean {
  return categories.includes(category);
}

export function formatPlaceCategoryLabels(categories: readonly PlaceCategory[]): string {
  return categories.map((c) => placeCategoryLabels[c] ?? c).join(' · ');
}

export function getPlaceCategoryMarker(category: string) {
  return placeCategoryMarker[category as PlaceCategory] ?? placeCategoryMarker.other;
}

/** Filter pills for the directory: All plus categories present in the given listings. */
export function placeCategoryFilterOptions(
  places: readonly { data: { categories?: readonly PlaceCategory[] } }[],
): { value: '' | PlaceCategory; label: string }[] {
  const present = new Set<PlaceCategory>();
  for (const place of places) {
    for (const c of place.data.categories ?? []) present.add(c);
  }
  const options: { value: '' | PlaceCategory; label: string }[] = [{ value: '', label: 'All' }];
  for (const value of PLACE_CATEGORY_VALUES) {
    if (present.has(value)) {
      options.push({ value, label: placeCategoryLabels[value] });
    }
  }
  return options;
}

export const PLACE_TYPE_VALUES = ['business', 'park', 'landmark'] as const;
export type PlaceType = (typeof PLACE_TYPE_VALUES)[number];

export const PLACE_TYPE_LABELS: Record<PlaceType, string> = {
  business: 'Business',
  park: 'Park',
  landmark: 'Landmark',
};

export const PLACE_TYPE_BADGE_CLASS: Record<PlaceType, string> = {
  business: 'bg-blue-100 text-blue-800',
  park: 'bg-green-100 text-green-800',
  landmark: 'bg-purple-100 text-purple-800',
};

export function placeTypeLabel(placeType: PlaceType): string {
  return PLACE_TYPE_LABELS[placeType];
}

/** First listed category drives map pin color. */
export function placePrimaryCategory(categories: readonly PlaceCategory[]): PlaceCategory {
  return categories[0] ?? 'other';
}
