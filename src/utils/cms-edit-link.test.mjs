import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cmsEditHref,
  cmsEditHrefForPathname,
  cmsEditTargetFromPathname,
} from './cms-edit-link.mjs';

test('cmsEditTargetFromPathname maps CMS content pages', () => {
  assert.deepEqual(cmsEditTargetFromPathname('/news/2026-06-04-learn-how-to-prepare-for-wildfire'), {
    collection: 'news',
    entryId: '2026-06-04-learn-how-to-prepare-for-wildfire',
  });
  assert.deepEqual(cmsEditTargetFromPathname('/places/some-business'), {
    collection: 'places',
    entryId: 'some-business',
  });
  assert.deepEqual(cmsEditTargetFromPathname('/our-work/bozeman-udc'), {
    collection: 'objectives',
    entryId: 'bozeman-udc',
  });
  assert.deepEqual(cmsEditTargetFromPathname('/our-work/nena-meetings/2025-fall-meeting'), {
    collection: 'meetings',
    entryId: '2025-fall-meeting',
  });
  assert.deepEqual(cmsEditTargetFromPathname('/our-work/nena-meetings'), {
    collection: 'objectives',
    entryId: 'nena-meetings',
  });
});

test('cmsEditTargetFromPathname ignores static and listing pages', () => {
  assert.equal(cmsEditTargetFromPathname('/about'), null);
  assert.equal(cmsEditTargetFromPathname('/places/past'), null);
  assert.equal(cmsEditTargetFromPathname('/places/archive'), null);
  assert.equal(cmsEditTargetFromPathname('/news/page/2'), null);
  assert.equal(cmsEditTargetFromPathname('/our-work/neighborhood-communication'), null);
  assert.equal(cmsEditTargetFromPathname('/our-work/past'), null);
});

test('cmsEditTargetFromPathname strips deploy base path', () => {
  assert.deepEqual(
    cmsEditTargetFromPathname('/nena-public-website/events/spring-picnic', '/nena-public-website/'),
    { collection: 'events', entryId: 'spring-picnic' },
  );
});

test('cmsEditHref builds Decap CMS deep links', () => {
  assert.equal(
    cmsEditHref('/', { collection: 'news', entryId: '2026-06-04-foo' }),
    '/admin/#/collections/news/entries/2026-06-04-foo',
  );
  assert.equal(
    cmsEditHrefForPathname('/history/founding-era'),
    '/admin/#/collections/history/entries/founding-era',
  );
});
