import { createRequire } from 'node:module';
import test from 'node:test';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import yaml from 'js-yaml';

const require = createRequire(import.meta.url);
const adminDir = join(dirname(fileURLToPath(import.meta.url)), '../public/admin');
const { quoteFrontmatterDateFields } = require(join(adminDir, 'quote-frontmatter-dates.js'));
const { parseFrontmatter, serializeFrontmatter } = require(join(adminDir, 'frontmatter-format.js'));

test('parseFrontmatter reads YAML front matter and body', () => {
  const input = `---
title: Idaho Pole
submittedDate: '2020-11-21'
---

# Heading
`;
  const parsed = parseFrontmatter(input, yaml);
  assert.equal(parsed.title, 'Idaho Pole');
  assert.equal(parsed.submittedDate, '2020-11-21');
  assert.match(parsed.body.trim(), /^# Heading/);
});

test('serializeFrontmatter quotes unquoted date-only fields on save', () => {
  const output = serializeFrontmatter(
    {
      title: 'NCOD On-Line Survey Now Open',
      date: '2026-06-09',
      body: 'Survey details\n',
    },
    ['title', 'date'],
    yaml,
    quoteFrontmatterDateFields,
  );
  assert.match(output, /^date: '2026-06-09'/m);
  assert.match(output, /Survey details/);
});

test('serializeFrontmatter quotes unquoted event datetimes on save', () => {
  const output = serializeFrontmatter(
    {
      title: 'Juneteenth Celebration',
      startDate: '2026-06-19T15:00:00',
      endDate: '2026-06-19T20:00:00',
      body: 'Event details\n',
    },
    ['title', 'startDate', 'endDate'],
    yaml,
    quoteFrontmatterDateFields,
  );
  assert.match(output, /^startDate: '2026-06-19T15:00:00'/m);
  assert.match(output, /^endDate: '2026-06-19T20:00:00'/m);
});
