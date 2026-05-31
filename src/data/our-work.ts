/** Our Work hub — section groupings for nav and section landing pages. */

import { getCollection, type CollectionEntry } from 'astro:content';

export const OUR_WORK_PATH = 'our-work';

export type OurWorkLink = {
  label: string;
  href: string;
  summary?: string;
  external?: boolean;
  /** Indented sub-link in the nav dropdown. */
  nested?: boolean;
};

export type OurWorkLinkRef =
  | {
      kind: 'objective';
      slug: string;
      nested?: boolean;
    }
  | {
      kind: 'custom';
      label: string;
      href: string;
      summary?: string;
      external?: boolean;
      nested?: boolean;
    };

export type OurWorkSectionConfig = {
  id: string;
  label: string;
  /** Section landing page at `/our-work/{hubSlug}`. Omit when `hubHref` is set. */
  hubSlug?: string;
  /** Section hub elsewhere on the site (e.g. `development`). Takes precedence over `hubSlug`. */
  hubHref?: string;
  description: string;
  links: OurWorkLinkRef[];
};

export type OurWorkSection = Omit<OurWorkSectionConfig, 'links'> & {
  links: OurWorkLink[];
};

export const OUR_WORK_SECTION_CONFIG: OurWorkSectionConfig[] = [
  {
    id: 'neighborhood-communication',
    label: 'Neighborhood Communication',
    hubSlug: 'neighborhood-communication',
    description: 'Meetings, newsletters, and neighbor surveys that keep Northeast informed.',
    links: [
      { kind: 'objective', slug: 'nena-meetings' },
      {
        kind: 'custom',
        label: 'NENA newsletters',
        href: 'newsletter',
        summary: 'Seasonal neighborhood news and announcements.',
      },
      { kind: 'objective', slug: 'nena-survey' },
    ],
  },
  {
    id: 'neighborhood-advocacy',
    label: 'Neighborhood Advocacy',
    hubSlug: 'neighborhood-advocacy',
    description:
      'City planning, preservation, housing, mobility, and other issues NENA follows on neighbors’ behalf.',
    links: [
      { kind: 'objective', slug: 'bozeman-udc' },
      { kind: 'objective', slug: 'ncod-guidelines' },
      { kind: 'objective', slug: 'bozeman-creek-vision-plan' },
      { kind: 'objective', slug: 'inter-neighborhood-council' },
      { kind: 'objective', slug: 'northeast-urban-renewal-district' },
      { kind: 'objective', slug: 'parade-of-sheds' },
      { kind: 'objective', slug: 'safe-quiet-rail-crossings' },
      { kind: 'objective', slug: 'trees' },
      { kind: 'objective', slug: 'affordable-housing' },
      { kind: 'objective', slug: 'trails-pocket-parks' },
    ],
  },
  {
    id: 'development-watch',
    label: 'Development Watch',
    hubHref: 'development',
    description: 'Active development proposals and projects in the Northeast Neighborhood.',
    links: [
      {
        kind: 'custom',
        label: 'All development projects',
        href: 'development',
        summary: 'Map and list of current projects NENA is tracking.',
      },
    ],
  },
];

function resolveOurWorkLinkRef(
  ref: OurWorkLinkRef,
  objectivesBySlug: Map<string, CollectionEntry<'objectives'>>,
  sectionId: string,
): OurWorkLink {
  if (ref.kind === 'custom') {
    return {
      label: ref.label,
      href: ref.href,
      summary: ref.summary,
      external: ref.external,
      nested: ref.nested,
    };
  }

  const objective = objectivesBySlug.get(ref.slug);
  if (!objective) {
    throw new Error(`Our Work section "${sectionId}" references missing objective: ${ref.slug}`);
  }

  return {
    label: objective.data.title,
    href: `${OUR_WORK_PATH}/${objective.slug}`,
    summary: objective.data.summary,
    nested: ref.nested,
  };
}

export async function getOurWorkSections(): Promise<OurWorkSection[]> {
  const objectives = await getCollection('objectives');
  const objectivesBySlug = new Map(objectives.map((objective) => [objective.slug, objective]));

  return OUR_WORK_SECTION_CONFIG.map((section) => ({
    ...section,
    links: section.links.map((ref) => resolveOurWorkLinkRef(ref, objectivesBySlug, section.id)),
  }));
}

export async function ourWorkSectionByHubSlug(slug: string): Promise<OurWorkSection | undefined> {
  const sections = await getOurWorkSections();
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
