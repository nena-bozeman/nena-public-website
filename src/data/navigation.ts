/** Shared site navigation — Option B (task-based grouping). */

import { getCollection } from 'astro:content';
import { assertLucideIconName, type NavIconName } from './nav-icons';
import { OUR_WORK_PATH, type OurWorkSection, ourWorkSectionNavHref } from './our-work';

export type NavItem = {
  label: string;
  href: string;
  description?: string;
  external?: boolean;
  /** Indented sub-link (e.g. objectives under the objectives hub). */
  nested?: boolean;
  /** Lucide icon name. Rendered when set, in the desktop dropdown and the mobile menu. */
  icon?: NavIconName;
};

export type NavSection = {
  label?: string;
  /** Section hub link when the heading should navigate (e.g. our-work section pages). */
  href?: string;
  /** Lucide icon name shown beside the section heading when set. */
  icon?: NavIconName;
  links: NavItem[];
};

export type NavGroup = {
  id: string;
  label: string;
  description?: string;
  /** When set, the label links to this hub; a chevron button toggles the dropdown. */
  hubHref?: string;
  /** Extra classes for the desktop dropdown panel (for example a fixed width). */
  panelClass?: string;
  /** Which edge of the trigger the desktop panel hangs from. */
  panelAlign?: 'start' | 'end';
  /**
   * Lucide icon beside this group in the mobile menu.
   * Group labels are not markdown pages, so the name stays in this config.
   * Omitted from the desktop bar so the header stays a short text row.
   */
  icon?: NavIconName;
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

/** Nav hrefs backed by `src/content/pages/{slug}.md`. The icon comes from that file. */
const PAGE_NAV_HREFS = new Set(['about', 'governance', 'community', 'donate', 'contact']);

function navIcon(name: string, context: string): NavIconName {
  return assertLucideIconName(name, context);
}

function pageNavItem(
  label: string,
  href: string,
  iconByHref: Map<string, string | undefined>,
): NavItem {
  const icon = iconByHref.get(href);
  if (!icon) {
    throw new Error(
      `Missing nav icon for "${label}". Set icon in src/content/pages/${href}.md.`,
    );
  }
  return { label, href, icon: navIcon(icon, `page "${href}"`) };
}

function configNavItem(label: string, href: string, icon: string): NavItem {
  return { label, href, icon: navIcon(icon, `nav item "${label}"`) };
}

export async function buildNavGroups(ourWorkSections: OurWorkSection[]): Promise<NavGroup[]> {
  const pages = await getCollection('pages');
  const iconByHref = new Map(
    pages.filter((page) => PAGE_NAV_HREFS.has(page.id)).map((page) => [page.id, page.data.icon]),
  );

  return [
    {
      id: 'news-events',
      label: 'News & Events',
      description: 'Stay informed about neighborhood news and gatherings',
      icon: navIcon('calendar-range', 'nav group "News & Events"'),
      sections: [
        {
          links: [
            configNavItem('News', 'news', 'newspaper'),
            configNavItem('Events', 'events', 'calendar-days'),
            configNavItem('Newsletter', 'newsletter', 'mail-open'),
          ],
        },
      ],
    },
    {
      id: 'neighborhood',
      label: 'Our Neighborhood',
      description: 'Explore the place, history, and local connections',
      icon: navIcon('map', 'nav group "Our Neighborhood"'),
      sections: [
        {
          links: [
            configNavItem('History', 'history', 'book-open'),
            configNavItem('Places', 'places', 'map-pin'),
            pageNavItem('Community', 'community', iconByHref),
          ],
        },
      ],
    },
    {
      id: 'our-work',
      label: 'Our Work',
      hubHref: OUR_WORK_PATH,
      description: 'Neighborhood communication, advocacy, and development watch',
      panelClass: 'w-80',
      icon: navIcon('handshake', 'nav group "Our Work"'),
      sections: ourWorkSections.map((section) => ({
        label: section.label,
        href: ourWorkSectionNavHref(section),
        icon: section.icon,
        links: [
          ...section.links.map((link) => ({
            label: link.label,
            href: link.href,
            nested: link.nested ?? true,
            external: link.external,
            icon: link.icon,
          })),
        ],
      })),
    },
    {
      id: 'get-involved',
      label: 'Get Involved',
      description: 'Learn, support, connect',
      icon: navIcon('hand-helping', 'nav group "Get Involved"'),
      panelClass: 'w-72',
      panelAlign: 'end',
      sections: [
        {
          label: 'Learn',
          links: [
            pageNavItem('About NENA', 'about', iconByHref),
            pageNavItem('Governance', 'governance', iconByHref),
            configNavItem('Bylaws', 'governance/bylaws', 'scroll-text'),
          ],
        },
        {
          label: 'Support',
          links: [pageNavItem('Donate', 'donate', iconByHref)],
        },
        {
          label: 'Connect',
          links: [
            configNavItem('Sign up for email alerts', 'newsletter', 'mail-plus'),
            pageNavItem('Contact', 'contact', iconByHref),
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
        { label: 'Past places', href: 'places/past' },
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

export const footerUtilityLinks: NavItem[] = [{ label: 'Admin', href: 'admin', external: true }];
