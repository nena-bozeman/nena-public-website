import { createRequire } from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const require = createRequire(import.meta.url);
const { quoteFrontmatterDateFields } = require(
  join(dirname(fileURLToPath(import.meta.url)), '../public/admin/quote-frontmatter-dates.js'),
);

test('quoteFrontmatterDateFields quotes unquoted date-only fields', () => {
  const input = `---
title: Save the Date
date: 2026-06-04
featured: false
---

Body text
`;
  const output = quoteFrontmatterDateFields(input);
  assert.match(output, /^date: '2026-06-04'/m);
  assert.doesNotMatch(output, /^date: 2026-06-04$/m);
});

test('quoteFrontmatterDateFields leaves already-quoted fields unchanged', () => {
  const input = `---
date: '2026-04-10'
meetingDate: '2024-10-01'
---

Notes
`;
  assert.equal(quoteFrontmatterDateFields(input), input);
});

test('quoteFrontmatterDateFields quotes unquoted event datetimes', () => {
  const input = `---
title: Potluck
startDate: 2026-04-13T17:30:00.000Z
endDate: 2026-07-29T16:00:00
---

Details
`;
  const output = quoteFrontmatterDateFields(input);
  assert.match(output, /^startDate: '2026-04-13T17:30:00.000Z'/m);
  assert.match(output, /^endDate: '2026-07-29T16:00:00'/m);
});
