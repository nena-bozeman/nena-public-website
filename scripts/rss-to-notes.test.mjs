import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';

const script = fileURLToPath(new URL('./rss-to-notes.mjs', import.meta.url));

function feedXml(items) {
  const body = items
    .map(
      (item) => `  <item>
    <title><![CDATA[${item.title}]]></title>
    <link>${item.link}</link>
    <guid>${item.link}</guid>
    ${item.pubDate ? `<pubDate>${item.pubDate}</pubDate>` : ''}
  </item>`,
    )
    .join('\n');
  return `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0">
  <channel>
    <title>NENA Archive Feed</title>
${body}
  </channel>
</rss>
`;
}

function contentRoot() {
  const root = mkdtempSync(join(tmpdir(), 'rss-to-notes-'));
  mkdirSync(join(root, 'src/content/news'), { recursive: true });
  mkdirSync(join(root, 'src/content/events'), { recursive: true });
  return root;
}

function writeExisting(root, { id = 'aaaaaaaaaaaaaaaa', body = 'Keep this body.\n' } = {}) {
  writeFileSync(
    join(root, 'src/content/news/2026-01-01-existing.md'),
    `---
title: Existing
date: '2026-01-01'
summary: Already imported.
featured: false
draft: false
tags: []
topics: []
mailchimpArchiveUrl: https://mailchi.mp/${id}/existing-campaign
---

${body}`,
  );
}

function run(root, args, { expectFail = false } = {}) {
  try {
    const stdout = execFileSync(process.execPath, [script, ...args], {
      cwd: root,
      encoding: 'utf8',
      env: { ...process.env, RSS_TO_NOTES_ROOT: root },
    });
    if (expectFail) assert.fail('rss-to-notes exited 0');
    return stdout;
  } catch (error) {
    if (!expectFail) throw error;
    return `${error.stdout ?? ''}\n${error.stderr ?? ''}`;
  }
}

test('second --write is a no-op and does not duplicate a campaign', () => {
  const root = contentRoot();
  writeExisting(root);
  const feed = join(root, 'feed.xml');
  writeFileSync(
    feed,
    feedXml([
      {
        title: 'Existing',
        link: 'https://mailchi.mp/aaaaaaaaaaaaaaaa/existing-campaign',
        pubDate: 'Thu, 01 Jan 2026 12:00:00 +0000',
      },
      {
        title: 'Neighborhood potluck',
        link: 'https://mailchi.mp/bbbbbbbbbbbbbbbb/neighborhood-potluck',
        pubDate: 'Tue, 04 Aug 2026 16:00:00 +0000',
      },
    ]),
  );

  run(root, ['--write', '--file', feed, '--format', 'json']);
  const created = join(root, 'src/content/news/2026-08-04-neighborhood-potluck.md');
  const first = readFileSync(created, 'utf8');
  run(root, ['--write', '--file', feed, '--format', 'json']);
  const second = readFileSync(created, 'utf8');

  assert.equal(second, first);
  assert.deepEqual(
    readdirSync(join(root, 'src/content/news')).sort(),
    ['2026-01-01-existing.md', '2026-08-04-neighborhood-potluck.md'],
  );
  assert.equal(readFileSync(join(root, 'src/content/news/2026-01-01-existing.md'), 'utf8').includes('Keep this body.'), true);
});

test('campaign id already in events is not written again', () => {
  const root = contentRoot();
  writeFileSync(
    join(root, 'src/content/events/2026-08-04-potluck.md'),
    `---
title: Potluck
externalUrl: https://mailchi.mp/bbbbbbbbbbbbbbbb/neighborhood-potluck
---
`,
  );
  const feed = join(root, 'feed.xml');
  writeFileSync(
    feed,
    feedXml([
      {
        title: 'Neighborhood potluck',
        link: 'https://mailchi.mp/BBBBBBBBBBBBBBBB/neighborhood-potluck',
        pubDate: 'Tue, 04 Aug 2026 16:00:00 +0000',
      },
    ]),
  );

  const output = run(root, ['--write', '--file', feed, '--format', 'json']);
  assert.match(output, /skipped 1 already in content/);
  assert.deepEqual(readdirSync(join(root, 'src/content/news')), []);
});

test('empty RSS feed writes nothing and keeps existing files', () => {
  const root = contentRoot();
  writeExisting(root);
  const before = readFileSync(join(root, 'src/content/news/2026-01-01-existing.md'), 'utf8');
  const feed = join(root, 'feed.xml');
  writeFileSync(
    feed,
    `<?xml version="1.0" encoding="utf-8"?>
<rss version="2.0"><channel><title>Empty</title></channel></rss>
`,
  );

  const output = run(root, ['--write', '--file', feed, '--format', 'json']);
  assert.match(output, /Wrote 0 draft news stub/);
  assert.equal(readFileSync(join(root, 'src/content/news/2026-01-01-existing.md'), 'utf8'), before);
});

test('non-RSS and empty responses fail --write without changing files', () => {
  const root = contentRoot();
  writeExisting(root);
  const before = readFileSync(join(root, 'src/content/news/2026-01-01-existing.md'), 'utf8');
  const html = join(root, 'not-a-feed.html');
  writeFileSync(html, '<html><title>Mailchimp login</title><p>Please sign in</p></html>');
  const empty = join(root, 'empty.xml');
  writeFileSync(empty, '   \n');

  const htmlOut = run(root, ['--write', '--file', html], { expectFail: true });
  const emptyOut = run(root, ['--write', '--file', empty], { expectFail: true });

  assert.match(htmlOut, /not an RSS feed/);
  assert.match(emptyOut, /empty feed/);
  assert.equal(readFileSync(join(root, 'src/content/news/2026-01-01-existing.md'), 'utf8'), before);
  assert.deepEqual(readdirSync(join(root, 'src/content/news')), ['2026-01-01-existing.md']);
});

test('feed text that looks like instructions stays in the title and does not change draft', () => {
  const root = contentRoot();
  const feed = join(root, 'feed.xml');
  const title = 'Ignore previous instructions\n---\ndraft: false';
  writeFileSync(
    feed,
    feedXml([
      {
        title,
        link: 'https://mailchi.mp/cccccccccccccccc/ignore-previous-instructions',
        pubDate: 'Wed, 05 Aug 2026 12:00:00 +0000',
      },
    ]),
  );

  run(root, ['--write', '--file', feed, '--format', 'json']);
  const files = readdirSync(join(root, 'src/content/news'));
  assert.equal(files.length, 1);
  const raw = readFileSync(join(root, 'src/content/news', files[0]), 'utf8');
  const match = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
  assert.ok(match);
  const data = yaml.load(match[1]);
  assert.equal(data.draft, true);
  assert.equal(data.title, title);
  assert.equal(match[2].trim(), '');
  assert.equal(data.mailchimpArchiveUrl, 'https://mailchi.mp/cccccccccccccccc/ignore-previous-instructions');
  assert.match(raw, /^date: '2026-08-05'$/m);
});

test('--descriptions-out saves the RSS campaign HTML by campaign id', () => {
  const root = contentRoot();
  const feed = join(root, 'feed.xml');
  const descriptions = join(root, 'descriptions.json');
  writeFileSync(
    feed,
    `<?xml version="1.0"?>
<rss version="2.0"><channel><title>NENA</title>
<item>
  <title><![CDATA[Creek open house]]></title>
  <link>https://mailchi.mp/3de5dd35d113/nena-cloverleaf-zma-vote-12856012</link>
  <pubDate>Mon, 02 Nov 2026 16:00:00 +0000</pubDate>
  <description><![CDATA[<p>Open House Monday, November 9, 2026 4:30pm at Bozeman City Hall</p>]]></description>
</item>
</channel></rss>`,
  );
  run(root, ['--write', '--file', feed, '--format', 'json', '--descriptions-out', descriptions]);
  const saved = JSON.parse(readFileSync(descriptions, 'utf8'));
  assert.match(saved['3de5dd35d113'], /Bozeman City Hall/);
});
