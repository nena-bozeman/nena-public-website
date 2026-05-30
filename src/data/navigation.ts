/** Shared site navigation — Option B (task-based grouping). */

import type { ListStatus } from '../schemas/list-status';

export type NavItem = {
  label: string;
  href: string;
  description?: string;
  external?: boolean;
};

export type NavSection = {
  label?: string;
  links: NavItem[];
};

export type NavGroup = {
  id: string;
  label: string;
  description?: string;
  sections: NavSection[];
};

export type FooterColumn = {
  label: string;
  links: NavItem[];
};

export type FeaturedObjective = {
  title: string;
  slug: string;
};

const FEATURED_OBJECTIVE_COUNT = 4;

/** Meta listings — not surfaced as featured committee links. */
const FEATURED_OBJECTIVE_SLUGS_TO_SKIP = new Set(['nena-newsletters']);

const SECTION_HUBS = new Set([
  'news',
  'events',
  'history',
  'businesses',
  'development',
  'objectives',
  'governance',
]);

export function resolveNavHref(base: string, href: string): string {
  const normalizedBase = base.endsWith('/') ? base : `${base}/`;
  return `${normalizedBase}${href}`.replace(/([^:]\/)\/+/g, '$1');
}

export function isNavItemActive(pathname: string, base: string, href: string): boolean {
  const full = resolveNavHref(base, href);
  const normPath =
    pathname.endsWith('/') && pathname.length > 1 ? pathname.slice(0, -1) : pathname;
  const normFull = full.endsWith('/') && full.length > 1 ? full.slice(0, -1) : full;

  if (normPath === normFull) {
    return true;
  }

  const rootSegment = href.split('/')[0] ?? href;
  if (SECTION_HUBS.has(rootSegment)) {
    return normPath.startsWith(`${normFull}/`);
  }

  return false;
}

export function getNavGroupLinks(group: NavGroup): NavItem[] {
  return group.sections.flatMap((section) => section.links);
}

export function isNavGroupActive(pathname: string, base: string, group: NavGroup): boolean {
  return getNavGroupLinks(group).some((item) => isNavItemActive(pathname, base, item.href));
}

export function getFeaturedObjectives(
  objectives: { slug: string; data: { title: string; status: ListStatus; order: number } }[],
): FeaturedObjective[] {
  return objectives
    .filter((objective) => objective.data.status === 'current' && !FEATURED_OBJECTIVE_SLUGS_TO_SKIP.has(objective.slug))
    .sort((a, b) => a.data.order - b.data.order)
    .slice(0, FEATURED_OBJECTIVE_COUNT)
    .map((objective) => ({
      title: objective.data.title,
      slug: objective.slug,
    }));
}

export function buildNavGroups(featuredObjectives: FeaturedObjective[]): NavGroup[] {
  return [
    {
      id: 'news-events',
      label: 'News & Events',
      description: 'Stay informed about neighborhood news and gatherings',
      sections: [
        {
          links: [
            { label: 'News', href: 'news' },
            { label: 'Events', href: 'events' },
            { label: 'Newsletter', href: 'newsletter' },
          ],
        },
      ],
    },
    {
      id: 'neighborhood',
      label: 'Our Neighborhood',
      description: 'Explore the place, history, and local connections',
      sections: [
        {
          links: [
            { label: 'History', href: 'history' },
            { label: 'Businesses', href: 'businesses' },
            { label: 'Community', href: 'community' },
          ],
        },
      ],
    },
    {
      id: 'our-work',
      label: 'Our Work',
      description: 'Advocacy, committees, and development watch',
      sections: [
        {
          links: [
            { label: 'All objectives & committees', href: 'objectives' },
            ...featuredObjectives.map((objective) => ({
              label: objective.title,
              href: `objectives/${objective.slug}`,
            })),
            { label: 'Development Watch', href: 'development' },
          ],
        },
      ],
    },
    {
      id: 'get-involved',
      label: 'Get Involved',
      description: 'Support NENA, connect with neighbors, and learn about the association',
      sections: [
        {
          links: [
            { label: 'Donate', href: 'donate' },
            { label: 'Contact', href: 'contact' },
            { label: 'Events', href: 'events' },
          ],
        },
        {
          label: 'About NENA',
          links: [
            { label: 'About NENA', href: 'about' },
            { label: 'Governance', href: 'governance' },
            { label: 'Bylaws', href: 'governance/bylaws' },
          ],
        },
      ],
    },
  ];
}

export function buildFooterColumns(): FooterColumn[] {
  return [
    {
      label: 'News & Events',
      links: [
        { label: 'News', href: 'news' },
        { label: 'Events', href: 'events' },
        { label: 'Newsletter', href: 'newsletter' },
      ],
    },
    {
      label: 'Our Neighborhood',
      links: [
        { label: 'History', href: 'history' },
        { label: 'Businesses', href: 'businesses' },
        { label: 'Community', href: 'community' },
      ],
    },
    {
      label: 'Our Work',
      links: [
        { label: 'Objectives', href: 'objectives' },
        { label: 'Development Watch', href: 'development' },
      ],
    },
    {
      label: 'Get Involved',
      links: [
        { label: 'Donate', href: 'donate' },
        { label: 'Contact', href: 'contact' },
        { label: 'Events', href: 'events' },
        { label: 'About NENA', href: 'about' },
        { label: 'Governance', href: 'governance' },
      ],
    },
  ];
}

export const footerUtilityLinks: NavItem[] = [{ label: 'Admin', href: 'admin' }];
