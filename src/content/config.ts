import { defineCollection, z } from 'astro:content';
import { DEVELOPMENT_PHASE_VALUES } from '../schemas/development-phase';
import { LIST_STATUS_VALUES } from '../schemas/list-status';
import { TOPIC_VALUES } from '../schemas/topics';

const listStatusSchema = z.enum(LIST_STATUS_VALUES).default('current');
const developmentPhaseSchema = z.enum(DEVELOPMENT_PHASE_VALUES);
const topicSchema = z.enum(TOPIC_VALUES);
const placeTypeSchema = z.enum(['business', 'park', 'landmark']).default('business');
const businessCategorySchema = z.enum([
  'food-drink',
  'retail',
  'services',
  'arts-culture',
  'fitness-wellness',
  'nonprofit',
  'other',
]);

const placeCategorySchema = z.enum([
  ...businessCategorySchema.options,
  'trails-pocket-parks',
]);

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
    /** Curated topics — power cross-collection linking. */
    topics: z.array(topicSchema).default([]),
    /** Freeform tags — display and search only. */
    tags: z.array(z.string()).default([]),
    developments: z.array(z.string()).default([]),
    places: z.array(z.string()).default([]),
    meetings: z.array(z.string()).default([]),
    events: z.array(z.string()).default([]),
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
    /** When true, listings and the event page show a cancelled label (event kept for the record). */
    cancelled: z.boolean().default(false),
    externalUrl: z.string().url().optional(),
    topics: z.array(topicSchema).default([]),
    tags: z.array(z.string()).default([]),
    meetingSlug: z.string().optional(),
    newsSlugs: z.array(z.string()).default([]),
    dateCreated: z.coerce.date().optional(),
    dateUpdated: z.coerce.date().optional(),
  }),
});

const places = defineCollection({
  type: 'content',
  schema: z
    .object({
      name: z.string(),
      placeType: placeTypeSchema,
      categories: z.array(placeCategorySchema).optional(),
      address: z.string(),
      website: z.string().url().optional(),
      phone: z.string().optional(),
      founded: z.number().optional(),
      logo: z.string().optional(),
      legacy: z.boolean().default(false),
      /** Current listings appear in the main directory; past listings are kept for the archive. */
      status: listStatusSchema,
      /** Year the business closed (optional; shown in archive when set). */
      closedYear: z.number().int().min(1900).max(2100).optional(),
      lat: z.number().optional(),
      lng: z.number().optional(),
      historySlug: z.string().optional(),
      topics: z.array(topicSchema).default([]),
      /**
       * Optional filename under `src/assets/businesses/` (e.g. `echo-arts.webp` or `brand/foo.png`).
       * If omitted, a file named `<slug>.{webp,jpg,png,…}` in that folder is used when present.
       */
      image: z.string().optional(),
      dateCreated: z.coerce.date().optional(),
      dateUpdated: z.coerce.date().optional(),
    })
    .superRefine((data, ctx) => {
      if (data.placeType === 'business' && (!data.categories || data.categories.length === 0)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'Business places require at least one category',
          path: ['categories'],
        });
      }
    }),
});

const history = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    /** One- or two-sentence summary shown on the timeline list view. */
    summary: z.string(),
    year: z.number(),
    decade: z.number(),
    category: z.enum(['founding', 'development', 'community', 'landmark', 'other']),
    image: z.string().optional(),
    imageAlt: z.string().optional(),
    topics: z.array(topicSchema).default([]),
    placeSlug: z.string().optional(),
    dateCreated: z.coerce.date().optional(),
    dateUpdated: z.coerce.date().optional(),
  }),
});

const development = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    /** Whether the project appears in the current Development Watch list or past archive. */
    status: listStatusSchema,
    phase: developmentPhaseSchema,
    address: z.string(),
    developer: z.string().optional(),
    submittedDate: z.coerce.date().optional(),
    dateCreated: z.coerce.date().optional(),
    dateUpdated: z.coerce.date(),
    summary: z.string(),
    cityPlanningUrl: z.string().url().optional(),
    lat: z.number().optional(),
    lng: z.number().optional(),
    topics: z.array(topicSchema).default([]),
    newsSlugs: z.array(z.string()).default([]),
  }),
});

const objectives = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    summary: z.string(),
    status: listStatusSchema,
    order: z.number().default(99),
    contactEmail: z.string().email().optional(),
    /** Curated topics matched against news and events for related content. */
    topics: z.array(topicSchema).default([]),
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
      topics: z.array(topicSchema).default([]),
      eventSlug: z.string().optional(),
      newsSlugs: z.array(z.string()).default([]),
      dateCreated: z.coerce.date().optional(),
      dateUpdated: z.coerce.date().optional(),
    }),
});

export const collections = {
  news,
  events,
  places,
  history,
  development,
  objectives,
  pages,
  meetings,
};
