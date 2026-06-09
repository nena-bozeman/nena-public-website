/** Our Work hub sections that objectives can belong to. */

import { z } from 'astro/zod';

export const OUR_WORK_OBJECTIVE_SECTION_IDS = [
  'neighborhood-communication',
  'neighborhood-advocacy',
] as const;

export type OurWorkObjectiveSectionId = (typeof OUR_WORK_OBJECTIVE_SECTION_IDS)[number];

export const ourWorkSectionSchema = z.enum(OUR_WORK_OBJECTIVE_SECTION_IDS);

export const OUR_WORK_OBJECTIVE_SECTION_LABELS: Record<OurWorkObjectiveSectionId, string> = {
  'neighborhood-communication': 'Neighborhood Communication',
  'neighborhood-advocacy': 'Neighborhood Advocacy',
};
