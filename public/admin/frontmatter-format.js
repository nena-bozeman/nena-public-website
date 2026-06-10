/**
 * Override Decap's built-in frontmatter formatter so date fields are quoted on save.
 *
 * CMS.getCustomFormatsFormatters() only lists custom formats, not built-ins, so
 * normalize-dates.js cannot wrap the default formatter that way. Register a full
 * frontmatter formatter here and post-process with quoteFrontmatterDateFields.
 *
 * Keep field names in sync with quote-frontmatter-dates.js and
 * scripts/validate-content-references.mjs.
 */
'use strict';

const FRONTMATTER_RE = /^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n([\s\S]*))?$/;

function parseFrontmatter(content, yaml) {
  const match = String(content).match(FRONTMATTER_RE);
  if (!match) return { body: content };
  const meta = yaml.load(match[1], { schema: yaml.JSON_SCHEMA }) || {};
  const body = match[2] || '';
  return {
    ...meta,
    ...(body.trim() && { body }),
  };
}

function serializeFrontmatter(data, sortedKeys, yaml, quoteFrontmatterDateFields) {
  const { body = '', ...meta } = data;
  let keys = Object.keys(meta);
  if (Array.isArray(sortedKeys) && sortedKeys.length > 0) {
    const sorted = sortedKeys.filter((key) => Object.prototype.hasOwnProperty.call(meta, key));
    const rest = keys.filter((key) => !sorted.includes(key));
    keys = [...sorted, ...rest];
  }
  const ordered = {};
  for (const key of keys) ordered[key] = meta[key];

  const yamlText = yaml
    .dump(ordered, {
      lineWidth: -1,
      noRefs: true,
      schema: yaml.JSON_SCHEMA,
    })
    .replace(/\s+$/, '');

  const trimLastLineBreak = body.slice(-1) !== '\n';
  let file = `---\n${yamlText}\n---\n${body}`;
  if (trimLastLineBreak && file.slice(-1) === '\n') {
    file = file.slice(0, -1);
  }
  return quoteFrontmatterDateFields(file);
}

function registerFrontmatterFormat(CMS, yaml, quoteFrontmatterDateFields) {
  CMS.registerCustomFormat('frontmatter', 'md', {
    fromFile(content) {
      return parseFrontmatter(content, yaml);
    },
    toFile(data, sortedKeys) {
      return serializeFrontmatter(data, sortedKeys, yaml, quoteFrontmatterDateFields);
    },
  });
}

const api = {
  FRONTMATTER_RE,
  parseFrontmatter,
  serializeFrontmatter,
  registerFrontmatterFormat,
};

if (typeof module !== 'undefined' && module.exports) {
  module.exports = api;
} else if (typeof globalThis !== 'undefined') {
  globalThis.NenaFrontmatterFormat = api;
}
