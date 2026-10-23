/** Our Work hub — section groupings for nav and section landing pages. */

import { getCollection, type CollectionEntry } from 'astro:content';
import { matchesListStatus, type ListStatus } from '../utils/list-status';
import { assertLucideIconName, type NavIconName } from './nav-icons';

export const OUR_WORK_PATH = 'our-work';

export type OurWorkLink = {
  label: string;
  href: string;
  summary?: string;
  external?: boolean;
  /** Indented sub-link in the nav dropdown. */
  nested?: boolean;
  /** Lucide icon name shown beside this link in the Our Work nav. */
  icon: NavIconName;
};

export type OurWorkCustomLinkRef = {
  order: number;
  label: string;
  href: string;
  summary?: string;
  external?: boolean;
  nested?: boolean;
  /** Lucide icon name shown beside this link in the Our Work nav. */
  icon: NavIconName;
};

export type OurWorkSectionConfig = {
  id: string;
  label: string;
  /** Section landing page at `/our-work/{hubSlug}`. Omit when `hubHref` is set. */
  hubSlug?: string;
  /** Section hub elsewhere on the site (e.g. `development`). Takes precedence over `hubSlug`. */
  hubHref?: string;
  description: string;
  /**
   * Lucide icon beside this section heading.
   * Section hubs are Astro pages, not markdown, so the name stays in this config.
   */
  icon: NavIconName;
  /** Non-objective links interleaved with section objectives by `order`. */
  customLinks: OurWorkCustomLinkRef[];
};

export type OurWorkSection = Omit<OurWorkSectionConfig, 'customLinks'> & {
  links: OurWorkLink[];
};

export type GetOurWorkSectionsOptions = {
  /** When set, objective links that do not match are omitted (custom links are always kept). */
  filterStatus?: ListStatus;
};

export const OUR_WORK_SECTION_CONFIG: OurWorkSectionConfig[] = [
  {
    id: 'neighborhood-communication',
    label: 'Neighborhood Communication',
    hubSlug: 'neighborhood-communication',
    description: 'Meetings, newsletters, and neighbor surveys that keep Northeast informed.',
    icon: 'messages-square',
    customLinks: [
      {
        order: 3,
        label: 'NENA Newsletters',
        href: 'newsletter',
        summary: 'Seasonal neighborhood news and announcements.',
        icon: 'newspaper',
      },
    ],
  },
  {
    id: 'neighborhood-advocacy',
    label: 'Neighborhood Advocacy',
    hubSlug: 'neighborhood-advocacy',
    description:
      'City planning, preservation, housing, mobility, and other issues NENA follows on neighbors’ behalf.',
    icon: 'megaphone',
    customLinks: [],
  },
  {
    id: 'development-watch',
    label: 'Development Watch',
    hubHref: 'development',
    description: 'Active development proposals and projects in the Northeast Neighborhood.',
    icon: 'eye',
    customLinks: [
      {
        order: 1,
        label: 'All development projects',
        href: 'development',
        summary: 'Map and list of current projects NENA is tracking.',
        icon: 'building',
      },
    ],
  },
];

type SortableLink = OurWorkLink & { sortOrder: number };

function objectiveToLink(objective: CollectionEntry<'objectives'>): SortableLink {
  const icon = objective.data.icon;
  if (!icon) {
    throw new Error(
      `Missing Our Work nav icon for "${objective.id}". Set icon in src/content/objectives/${objective.id}.md.`,
    );
  }

  return {
    sortOrder: objective.data.order,
    label: objective.data.title,
    href: `${OUR_WORK_PATH}/${objective.id}`,
    summary: objective.data.summary,
    nested: true,
    icon: assertLucideIconName(icon, `objective "${objective.id}"`),
  };
}

function customToLink(ref: OurWorkCustomLinkRef): SortableLink {
  return {
    sortOrder: ref.order,
    label: ref.label,
    href: ref.href,
    summary: ref.summary,
    external: ref.external,
    nested: ref.nested,
    icon: assertLucideIconName(ref.icon, `custom link "${ref.label}"`),
  };
}

function linksForSection(
  sectionId: string,
  objectives: CollectionEntry<'objectives'>[],
  customLinks: OurWorkCustomLinkRef[],
  filterStatus?: ListStatus,
): OurWorkLink[] {
  const objectiveLinks = objectives
    .filter(
      (objective) =>
        objective.data.section === sectionId &&
        objective.data.listed &&
        (!filterStatus || matchesListStatus(objective.data.status, filterStatus)),
    )
    .map(objectiveToLink);

  const custom = customLinks.map(customToLink);

  return [...objectiveLinks, ...custom]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map(({ sortOrder: _sortOrder, ...link }) => link);
}

export async function getOurWorkSections(
  options: GetOurWorkSectionsOptions = {},
): Promise<OurWorkSection[]> {
  const { filterStatus } = options;
  const objectives = await getCollection('objectives');

  return OUR_WORK_SECTION_CONFIG.map((section) => ({
    id: section.id,
    label: section.label,
    hubSlug: section.hubSlug,
    hubHref: section.hubHref,
    description: section.description,
    icon: assertLucideIconName(section.icon, `section "${section.label}"`),
    links: linksForSection(section.id, objectives, section.customLinks, filterStatus),
  }));
}

export async function ourWorkSectionByHubSlug(
  slug: string,
  options: GetOurWorkSectionsOptions = { filterStatus: 'current' },
): Promise<OurWorkSection | undefined> {
  const sections = await getOurWorkSections(options);
  return sections.find((section) => section.hubSlug === slug);
}

export function sectionHubHref(section: OurWorkSection, baseUrl: string): string {
  const href = ourWorkSectionNavHref(section);
  if (href) {
    return resolveOurWorkHref(baseUrl, href);
  }
  return resolveOurWorkHref(baseUrl, OUR_WORK_PATH);
}

export function ourWorkSectionNavHref(section: OurWorkSection | OurWorkSectionConfig): string | undefined {
  if (section.hubHref) {
    return section.hubHref;
  }
  if (section.hubSlug) {
    return `${OUR_WORK_PATH}/${section.hubSlug}`;
  }
  return undefined;
}

export function resolveOurWorkHref(baseUrl: string, href: string): string {
  if (href.startsWith('http://') || href.startsWith('https://')) {
    return href;
  }
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${base}${href}`.replace(/([^:]\/)\/+/g, '$1');
}

/** Slug from an internal our-work link (`our-work/bozeman-udc` → `bozeman-udc`). */
export function ourWorkSlugFromHref(href: string): string | null {
  const prefix = `${OUR_WORK_PATH}/`;
  if (!href.startsWith(prefix)) return null;
  const slug = href.slice(prefix.length).replace(/\/$/, '');
  return slug || null;
}
