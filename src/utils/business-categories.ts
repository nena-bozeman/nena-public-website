/** Values match `businesses` collection `categories` in `src/content/config.ts`. */
export const BUSINESS_CATEGORY_VALUES = [
  'food-drink',
  'retail',
  'services',
  'arts-culture',
  'fitness-wellness',
  'nonprofit',
  'other',
] as const;

export type BusinessCategory = (typeof BUSINESS_CATEGORY_VALUES)[number];

/** Shared labels and UI colors for business categories (content schema + map). */
export const businessCategoryLabels: Record<string, string> = {
  'food-drink': 'Food & Drink',
  retail: 'Retail',
  services: 'Services',
  'arts-culture': 'Arts & Culture',
  'fitness-wellness': 'Fitness & Wellness',
  nonprofit: 'Nonprofit',
  other: 'Other',
};

/** Tailwind classes for list/card badges (must stay in one place for consistency). */
export const businessCategoryBadgeClass: Record<string, string> = {
  'food-drink': 'bg-orange-100 text-orange-800',
  retail: 'bg-blue-100 text-blue-800',
  services: 'bg-gray-100 text-gray-800',
  'arts-culture': 'bg-purple-100 text-purple-800',
  'fitness-wellness': 'bg-green-100 text-green-800',
  nonprofit: 'bg-teal-100 text-teal-800',
  other: 'bg-gray-100 text-gray-800',
};

/**
 * Google Maps `SymbolPath.CIRCLE` marker fill/stroke (aligns with badge hues).
 * Stroke is light for contrast on the satellite/street basemap.
 */
export const businessCategoryMarker: Record<string, { fill: string; stroke: string }> = {
  'food-drink': { fill: '#ea580c', stroke: '#fff7ed' },
  retail: { fill: '#2563eb', stroke: '#eff6ff' },
  services: { fill: '#4b5563', stroke: '#f9fafb' },
  'arts-culture': { fill: '#9333ea', stroke: '#faf5ff' },
  'fitness-wellness': { fill: '#15803d', stroke: '#f0fdf4' },
  nonprofit: { fill: '#0d9488', stroke: '#f0fdfa' },
  other: { fill: '#6b7280', stroke: '#f9fafb' },
};

/** First listed category drives map pin color. */
export function businessPrimaryCategory(categories: readonly BusinessCategory[]): BusinessCategory {
  return categories[0] ?? 'other';
}

export function businessHasCategory(
  categories: readonly BusinessCategory[],
  category: BusinessCategory,
): boolean {
  return categories.includes(category);
}

export function formatBusinessCategoryLabels(categories: readonly BusinessCategory[]): string {
  return categories.map((c) => businessCategoryLabels[c] ?? c).join(' · ');
}

export function getBusinessCategoryMarker(category: string) {
  return businessCategoryMarker[category] ?? businessCategoryMarker.other;
}

/** Filter pills for the directory: All plus categories present in the given listings. */
export function businessCategoryFilterOptions(
  businesses: readonly { data: { categories: readonly BusinessCategory[] } }[],
): { value: '' | BusinessCategory; label: string }[] {
  const present = new Set<BusinessCategory>();
  for (const b of businesses) {
    for (const c of b.data.categories) present.add(c);
  }
  const options: { value: '' | BusinessCategory; label: string }[] = [
    { value: '', label: 'All' },
  ];
  for (const value of BUSINESS_CATEGORY_VALUES) {
    if (present.has(value)) {
      options.push({ value, label: businessCategoryLabels[value] });
    }
  }
  return options;
}
