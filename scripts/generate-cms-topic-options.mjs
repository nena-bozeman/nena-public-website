#!/usr/bin/env node
/**
 * Print Decap CMS topic multiselect options from src/schemas/topics.ts values.
 *
 * Usage: node scripts/generate-cms-topic-options.mjs
 */

const TOPIC_LABELS = {
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

const TOPIC_VALUES = Object.keys(TOPIC_LABELS);
console.log('# Decap CMS topic select options (sync with src/schemas/topics.ts)');
console.log('options:');
for (const value of TOPIC_VALUES) {
  console.log(`  - { label: "${TOPIC_LABELS[value]}", value: "${value}" }`);
}
