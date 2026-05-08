import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applySiteBaseToPathname,
  computeSiteRootPrefix,
  expandCraftSitePlaceholder,
  normalizeAstroBase,
} from './site-base.mjs';

test('normalizeAstroBase keeps trailing slash convention', () => {
  assert.equal(normalizeAstroBase('/nena-public-website'), '/nena-public-website/');
  assert.equal(normalizeAstroBase('/'), '/');
});

test('applySiteBaseToPathname prefixes root paths with deploy base', () => {
  assert.equal(
    applySiteBaseToPathname('/events', '/nena-public-website/'),
    '/nena-public-website/events',
  );
});

test('computeSiteRootPrefix combines site origin with base path', () => {
  assert.equal(
    computeSiteRootPrefix('https://example.org/', '/nena-public-website/'),
    'https://example.org/nena-public-website/',
  );
});

test('expandCraftSitePlaceholder replaces Craft {{ url:site }} token', () => {
  const prefix = 'https://example.org/nena-public-website/';
  assert.equal(
    expandCraftSitePlaceholder('{{ url:site }}files/download/abc', prefix),
    'https://example.org/nena-public-website/files/download/abc',
  );
});

test('expandCraftSitePlaceholder handles percent-encoded placeholder (built HTML style)', () => {
  const prefix = 'https://example.org/nena-public-website/';
  const href = '%7B%7B%20url:site%20%7D%7Dfiles/download/ff06ed062887086';
  assert.equal(
    expandCraftSitePlaceholder(href, prefix),
    'https://example.org/nena-public-website/files/download/ff06ed062887086',
  );
});
