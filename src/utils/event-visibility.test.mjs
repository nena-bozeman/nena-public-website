import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { eventsVisibleOnSite, isDraftEvent } from './event-visibility.mjs';

test('draft events stay out of production listings and calendar sync', () => {
  const published = { data: { title: 'Potluck', draft: false } };
  const implicit = { data: { title: 'Meeting' } };
  const draft = { data: { title: 'Unreviewed', draft: true } };

  assert.equal(isDraftEvent(published.data), false);
  assert.equal(isDraftEvent(implicit.data), false);
  assert.equal(isDraftEvent(draft.data), true);

  assert.deepEqual(eventsVisibleOnSite([published, implicit, draft], true), [published, implicit]);
  assert.deepEqual(eventsVisibleOnSite([published, draft], false), [published, draft]);

  const sync = readFileSync(
    fileURLToPath(new URL('../../scripts/sync-events-to-google-calendar.mjs', import.meta.url)),
    'utf8',
  );
  assert.match(sync, /if \(isDraftEvent\(data\)\) continue;/);
});
