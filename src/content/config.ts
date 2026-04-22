import { defineCollection, z } from 'astro:content';

const news = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    date: z.coerce.date(),
    summary: z.string(),
    author: z.string().optional(),
    featured: z.boolean().default(false),
    /** When true, omitted from production builds; in dev, listings and the post show a DRAFT label. */
    draft: z.boolean().default(false),
    tags: z.array(z.string()).default([]),
    dateCreated: z.coerce.date().optional(),
    /** Last update from the legacy CMS (Pyro), when different from publish date */
    dateUpdated: z.coerce.date().optional(),
    /** Posts migrated from Pyro CMS blog export */
    legacySource: z.enum(['pyro-cms']).optional(),
    legacyId: z.string().optional(),
    legacySlug: z.string().optional(),
    legacyBlogUrl: z.string().url().optional(),
  }),
});

const events = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    startDate: z.date(),
    endDate: z.date().optional(),
    location: z.string(),
    address: z.string().optional(),
    summary: z.string(),
    category: z.enum(['social', 'civic', 'committee', 'tour', 'other']),
    featured: z.boolean().default(false),
    externalUrl: z.string().url().optional(),
    dateCreated: z.coerce.date().optional(),
    dateUpdated: z.coerce.date().optional(),
  }),
});

const businesses = defineCollection({
  type: 'content',
  schema: z.object({
    name: z.string(),
    category: z.enum([
      'food-drink',
      'retail',
      'services',
      'arts-culture',
      'fitness-wellness',
      'nonprofit',
      'other'
    ]),
    address: z.string(),
    website: z.string().url().optional(),
    phone: z.string().optional(),
    founded: z.number().optional(),
    logo: z.string().optional(),
    legacy: z.boolean().default(false),
    /** Open listings appear in the main directory; closed listings are hidden there but kept for the archive. */
    status: z.enum(['open', 'closed']).default('open'),
    /** Year the business closed (optional; shown in archive when set). */
    closedYear: z.number().int().min(1900).max(2100).optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    /**
     * Optional filename under `src/assets/businesses/` (e.g. `echo-arts.webp` or `brand/foo.png`).
     * If omitted, a file named `<slug>.{webp,jpg,png,…}` in that folder is used when present.
     */
    image: z.string().optional(),
    dateCreated: z.coerce.date().optional(),
    dateUpdated: z.coerce.date().optional(),
  }),
});

const history = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    year: z.number(),
    decade: z.number(),
    category: z.enum(['founding', 'development', 'community', 'landmark', 'other']),
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    dateCreated: z.coerce.date().optional(),
    dateUpdated: z.coerce.date().optional(),
  }),
});

const development = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    status: z.enum(['proposed', 'under-review', 'approved', 'under-construction', 'complete', 'denied']),
    address: z.string(),
    developer: z.string().optional(),
    submittedDate: z.coerce.date().optional(),
    dateCreated: z.coerce.date().optional(),
    dateUpdated: z.coerce.date(),
    summary: z.string(),
    cityPlanningUrl: z.string().url().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    tags: z.array(z.string()).default([]),
  }),
});

const objectives = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    active: z.boolean().default(true),
    order: z.number().default(99),
    contactEmail: z.string().email().optional(),
    /** If non-empty, the objective page lists news posts tagged with any of these strings. */
    newsTags: z.array(z.string()).default([]),
    dateCreated: z.coerce.date().optional(),
    dateUpdated: z.coerce.date().optional(),
  }),
});

const pages = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    dateCreated: z.coerce.date().optional(),
    dateUpdated: z.coerce.date().optional(),
  }),
});

const meetings = defineCollection({
  type: 'content',
  schema: z
    .object({
      title: z.string(),
      meetingDate: z.coerce.date(),
      summary: z.string(),
      season: z.enum(['spring', 'fall', 'annual', 'other']).optional(),
      minutesPdf: z.string().optional(),
      minutesDocx: z.string().optional(),
      legacyUrl: z.string().url().optional(),
      dateCreated: z.coerce.date().optional(),
      dateUpdated: z.coerce.date().optional(),
    })
    .refine((d) => Boolean(d.minutesPdf || d.minutesDocx), {
      message: 'Each meeting needs minutesPdf and/or minutesDocx',
    }),
});

export const collections = { news, events, businesses, history, development, objectives, pages, meetings };
