import assert from 'node:assert/strict';
import test from 'node:test';
import { splitPageBody } from './page-sections.mjs';

test('splitPageBody splits on section markers', () => {
  const body = 'Intro\n\n<!-- @section board-officers -->\n\nOutro';
  assert.deepEqual(splitPageBody(body), [
    { type: 'markdown', content: 'Intro\n\n' },
    { type: 'section', name: 'board-officers' },
    { type: 'markdown', content: '\n\nOutro' },
  ]);
});

test('splitPageBody returns a single markdown segment when no markers', () => {
  assert.deepEqual(splitPageBody('Hello'), [{ type: 'markdown', content: 'Hello' }]);
});
