import assert from 'node:assert/strict';
import test from 'node:test';
import { remarkExpandCraftSitePlaceholder } from './remark-expand-craft-site-placeholder.mjs';

const PREFIX = 'https://example.org/nena-public-website/';

function run(tree) {
  remarkExpandCraftSitePlaceholder({ siteRoot: PREFIX })(tree);
  return tree;
}

test('remark plugin expands placeholder in link URLs', () => {
  const tree = {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [
          {
            type: 'link',
            url: '{{ url:site }}files/download/abc',
            children: [{ type: 'text', value: 'PDF' }],
          },
        ],
      },
    ],
  };
  run(tree);
  assert.equal(tree.children[0].children[0].url, `${PREFIX}files/download/abc`);
});

test('remark plugin converts leading image markdown when paragraph has hard break', () => {
  const tree = {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [
          { type: 'text', value: '![]({{ url:site }}files/large/abc)  ' },
          { type: 'break' },
          { type: 'text', value: 'Caption text' },
        ],
      },
    ],
  };
  run(tree);
  const kids = tree.children[0].children;
  assert.equal(kids[0].type, 'image');
  assert.equal(kids[0].url, `${PREFIX}files/large/abc`);
  assert.equal(kids[2].value, 'Caption text');
});

test('remark plugin expands placeholder left in plain text', () => {
  const tree = {
    type: 'root',
    children: [
      {
        type: 'paragraph',
        children: [{ type: 'text', value: 'See {{ url:site }}files/download/x for details.' }],
      },
    ],
  };
  run(tree);
  assert.equal(
    tree.children[0].children[0].value,
    `See ${PREFIX}files/download/x for details.`,
  );
});
