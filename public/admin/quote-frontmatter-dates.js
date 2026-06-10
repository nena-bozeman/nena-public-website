/**
 * Quote date-only and event datetime frontmatter fields for Decap CMS saves.
 * Keep field names in sync with normalize-dates.js and validate-content-references.mjs.
 */
'use strict';

const DATE_ONLY_FIELDS = ['date', 'meetingDate', 'submittedDate'];
const DATETIME_FIELDS = ['startDate', 'endDate'];
const DATE_ONLY_VALUE = String.raw`\d{4}-\d{2}-\d{2}`;
const DATETIME_VALUE = String.raw`\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?(?:Z)?`;

function quoteYamlField(yaml, field, valuePattern) {
  return yaml.replace(
    new RegExp(`^(${field}):\\s*(?!['"])(${valuePattern})\\s*$`, 'gm'),
    "$1: '$2'",
  );
}

function quoteFrontmatterDateFields(fileText) {
  const match = fileText.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return fileText;

  let yaml = match[1];
  DATE_ONLY_FIELDS.forEach((field) => {
    yaml = quoteYamlField(yaml, field, DATE_ONLY_VALUE);
  });
  DATETIME_FIELDS.forEach((field) => {
    yaml = quoteYamlField(yaml, field, DATETIME_VALUE);
  });

  if (yaml === match[1]) return fileText;
  return fileText.replace(match[0], `---\n${yaml}\n---`);
}

const api = {
  DATE_ONLY_FIELDS,
  DATETIME_FIELDS,
  quoteYamlField,
  quoteFrontmatterDateFields,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
} else if (typeof globalThis !== 'undefined') {
  globalThis.QuoteFrontmatterDates = api;
}
