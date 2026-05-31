/** Curated topics — power cross-collection linking (objectives, related news/events, topic browse). */

import { OUR_WORK_PATH } from '../data/our-work';

export const TOPIC_VALUES = [
  'newsletter',
  'meeting',
  'bozeman-udc',
  'affordable-housing',
  'parade-of-sheds',
  'visionne',
  'trees',
  'trails-pocket-parks',
  'traffic-calming',
  'nena-survey',
  'safe-quiet-rail-crossings',
  'environment',
  'volunteer',
  'community',
  'historic-preservation',
  'parking',
] as const;

export type Topic = (typeof TOPIC_VALUES)[number];

export const TOPIC_LABELS: Record<Topic, string> = {
  newsletter: 'NENA Newsletters',
  meeting: 'NENA Meetings',
  'bozeman-udc': 'Bozeman UDC',
  'affordable-housing': 'Affordable Housing',
  'parade-of-sheds': 'Parade of Sheds',
  visionne: 'VisionNE',
  trees: 'NENA Trees',
  'trails-pocket-parks': 'Trails & Parks',
  'traffic-calming': 'Traffic Calming',
  'nena-survey': 'NENA Survey',
  'safe-quiet-rail-crossings': 'Safe & Quiet Rail Crossings',
  environment: 'Environment',
  volunteer: 'Volunteer',
  community: 'Community',
  'historic-preservation': 'Historic Preservation',
  parking: 'Parking',
};

/** Objective slug tied to a topic, when one exists. */
export const TOPIC_OBJECTIVE_SLUG: Partial<Record<Topic, string>> = {
  newsletter: 'nena-newsletters',
  meeting: 'nena-meetings',
  'bozeman-udc': 'bozeman-udc',
  'affordable-housing': 'affordable-housing',
  'parade-of-sheds': 'parade-of-sheds',
  visionne: 'visionne',
  trees: 'trees',
  'trails-pocket-parks': 'trails-pocket-parks',
  'traffic-calming': 'traffic-calming',
  'nena-survey': 'nena-survey',
  'historic-preservation': 'ncod-guidelines',
  'safe-quiet-rail-crossings': 'safe-quiet-rail-crossings',
  community: 'inter-neighborhood-council',
};

export function isTopic(value: string): value is Topic {
  return (TOPIC_VALUES as readonly string[]).includes(value);
}

export function formatTopicLabel(topic: Topic): string {
  return TOPIC_LABELS[topic];
}

export function topicListingHref(topic: Topic, baseUrl: string): string {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  return `${base}topics/${topic}`;
}

export function objectiveHrefForTopic(topic: Topic, baseUrl: string): string | null {
  const base = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  if (topic === 'newsletter') {
    return `${base}newsletter`;
  }
  const slug = TOPIC_OBJECTIVE_SLUG[topic];
  if (!slug) return null;
  return `${base}${OUR_WORK_PATH}/${slug}`;
}

export function allTopics(): readonly Topic[] {
  return TOPIC_VALUES;
}

/** CMS multiselect options — keep in sync via scripts/generate-cms-topic-options.mjs */
export function cmsTopicSelectOptions(): { label: string; value: Topic }[] {
  return TOPIC_VALUES.map((value) => ({
    label: TOPIC_LABELS[value],
    value,
  }));
}
