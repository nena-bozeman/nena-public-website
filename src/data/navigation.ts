/** Shared site navigation — Option B (task-based grouping). */

import { OUR_WORK_PATH, type OurWorkSection, ourWorkSectionNavHref } from './our-work';

export type NavItem = {
  label: string;
  href: string;
  description?: string;
  external?: boolean;
  /** Indented sub-link (e.g. objectives under the objectives hub). */
  nested?: boolean;
};

export type NavSection = {
  label?: string;
  /** Section hub link when the heading should navigate (e.g. our-work section pages). */
  href?: string;
  links: NavItem[];
};

export type NavGroup = {
  id: string;
  label: string;
  description?: string;
  /** When set, the label links to this hub; a chevron button toggles the dropdown. */
  hubHref?: string;
  sections: NavSection[];
};

export type FooterColumn = {
  label: string;
  links: NavItem[];
};

const SECTION_HUBS = new Set([
  'news',
  'events',
  'history',
  'places',
  'businesses',
  'development',
  OUR_WORK_PATH,
  'governance',
]);

export function resolveNavHref(base: string, href: string): string {
  if (href.startsWith('http://') || href.startsWith('https://')) {
    return href;
  }
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
  const sectionLinks = group.sections.flatMap((section) =>
    section.href ? [{ label: section.label ?? '', href: section.href }] : [],
  );
  return [...sectionLinks, ...group.sections.flatMap((section) => section.links)];
}

export function isNavGroupActive(pathname: string, base: string, group: NavGroup): boolean {
  if (group.hubHref && isNavItemActive(pathname, base, group.hubHref)) {
    return true;
  }
  return getNavGroupLinks(group).some((item) => isNavItemActive(pathname, base, item.href));
}

export function buildNavGroups(ourWorkSections: OurWorkSection[]): NavGroup[] {
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
            { label: 'Places', href: 'places' },
            { label: 'Community', href: 'community' },
          ],
        },
      ],
    },
    {
      id: 'our-work',
      label: 'Our Work',
      hubHref: OUR_WORK_PATH,
      description: 'Neighborhood communication, advocacy, and development watch',
      sections: ourWorkSections.map((section) => ({
        label: section.label,
        href: ourWorkSectionNavHref(section),
        links: [
          ...section.links.map((link) => ({
            label: link.label,
            href: link.href,
            nested: link.nested ?? true,
            external: link.external,
          })),
        ],
      })),
    },
    {
      id: 'get-involved',
      label: 'Get Involved',
      description: 'Learn, support, connect',
      sections: [
        {
          label: 'Learn',
          links: [
            { label: 'About NENA', href: 'about' },
            { label: 'Governance', href: 'governance' },
            { label: 'Bylaws', href: 'governance/bylaws' },
          ],
        },
        {
          label: 'Support',
          links: [{ label: 'Donate', href: 'donate' }],
        },
        {
          label: 'Connect',
          links: [
            { label: 'Sign up for email alerts', href: 'newsletter' },
            { label: 'Contact', href: 'contact' },
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
        { label: 'Places', href: 'places' },
        { label: 'Community', href: 'community' },
      ],
    },
    {
      label: 'Our Work',
      links: [
        { label: 'Our Work', href: OUR_WORK_PATH },
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
