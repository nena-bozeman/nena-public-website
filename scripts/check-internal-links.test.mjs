import assert from 'node:assert/strict';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import {
  fileRelToDirUrlPath,
  isLegacyCraftAssetPath,
  navigationalHrefIssue,
  resolveInternalPathname,
  skipHrefReason,
  stripBase,
} from './check-internal-links.mjs';

test('skipHrefReason recognizes common non-navigational schemes', () => {
  assert.equal(skipHrefReason(''), 'empty');
  assert.equal(skipHrefReason('mailto:a@b.co'), 'mailto');
  assert.equal(skipHrefReason('tel:+1'), 'tel');
  assert.equal(skipHrefReason('javascript:void(0)'), 'javascript');
  assert.equal(skipHrefReason('data:image/png;base64,xx'), 'data');
  assert.equal(skipHrefReason('/about'), null);
});

test('fileRelToDirUrlPath maps dist files to directory URL paths', () => {
  assert.equal(fileRelToDirUrlPath('index.html', '/nena-public-website'), '/nena-public-website/');
  assert.equal(
    fileRelToDirUrlPath('development/idaho-pole/index.html', '/nena-public-website'),
    '/nena-public-website/development/idaho-pole/',
  );
});

test('stripBase removes configured Astro base prefix', () => {
  assert.equal(stripBase('/nena-public-website/news/foo', '/nena-public-website'), '/news/foo');
  assert.equal(stripBase('/nena-public-website', '/nena-public-website'), '/');
});

test('isLegacyCraftAssetPath matches migrated Craft /files/* asset URLs', () => {
  assert.equal(isLegacyCraftAssetPath('/nena-public-website/files/download/abc'), true);
  assert.equal(isLegacyCraftAssetPath('/files/thumb/x/y'), true);
  assert.equal(
    isLegacyCraftAssetPath('/nena-public-website/development/idaho-pole/{{ url:site }}files/download/x'),
    false,
  );
});

test('legacy Craft /files/download href is accepted without a dist file', () => {
  const tmpDist = mkdtempSync(join(tmpdir(), 'nena-link-test-'));
  const routing = { basePath: '/nena-public-website', siteOrigin: null };
  const issue = navigationalHrefIssue(
    '/nena-public-website/files/download/ff06ed062887086',
    'development/idaho-pole/index.html',
    routing,
    tmpDist,
  );
  assert.equal(issue, null);
});

test('percent-encoded Statamic placeholder href is flagged (ambiguous relative resolution)', () => {
  const tmpDist = mkdtempSync(join(tmpdir(), 'nena-link-test-'));
  const routing = { basePath: '/nena-public-website', siteOrigin: null };
  const href =
    '%7B%7B%20url:site%20%7D%7Dfiles/download/ff06ed062887086';
  const issue = navigationalHrefIssue(
    href,
    'development/idaho-pole/index.html',
    routing,
    tmpDist,
  );
  assert.ok(issue);
  assert.match(issue.resolved, /^ambiguous:/);
});

test('external https origin is not treated as internal navigation', () => {
  const routing = {
    basePath: '/nena-public-website',
    siteOrigin: 'https://example.github.io',
  };
  const fromDir = '/nena-public-website/news/';
  assert.equal(
    resolveInternalPathname('https://other.example/page', fromDir, routing),
    null,
  );
});
