import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import { findNewNewsStubs } from './rss-stubs-branch.mjs';

const script = fileURLToPath(new URL('./rss-stubs-branch.mjs', import.meta.url));

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

const EXISTING = `---
title: Existing
date: '2026-01-01'
summary: Already imported.
featured: false
draft: false
tags: []
topics: []
mailchimpArchiveUrl: https://mailchi.mp/aaaaaaaaaaaaaaaa/existing-campaign
---

Keep this body.
`;

const KNOWN_ITEM = {
  title: 'Existing',
  link: 'https://mailchi.mp/aaaaaaaaaaaaaaaa/existing-campaign',
  pubDate: 'Thu, 01 Jan 2026 12:00:00 +0000',
};

const POTLUCK = {
  title: 'Neighborhood potluck',
  link: 'https://mailchi.mp/bbbbbbbbbbbbbbbb/neighborhood-potluck',
  pubDate: 'Tue, 04 Aug 2026 16:00:00 +0000',
};

const POTLUCK_PATH = 'src/content/news/2026-08-04-neighborhood-potluck.md';

function git(repo, args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8' });
}

function initRepo() {
  const parent = mkdtempSync(join(tmpdir(), 'rss-branch-'));
  const repo = join(parent, 'repo');
  mkdirSync(join(repo, 'src/content/news'), { recursive: true });
  mkdirSync(join(repo, 'src/content/events'), { recursive: true });
  writeFileSync(join(repo, 'src/content/news/2026-01-01-existing.md'), EXISTING);
  writeFileSync(join(repo, 'src/content/events/.gitkeep'), '');
  git(repo, ['init', '-b', 'main']);
  git(repo, ['config', 'user.name', 'Test']);
  git(repo, ['config', 'user.email', 'test@example.com']);
  git(repo, ['config', 'commit.gpgsign', 'false']);
  git(repo, ['add', 'src']);
  git(repo, ['commit', '-m', 'Initial content']);
  return { parent, repo };
}

function writeFeed(parent, items) {
  const feed = join(parent, 'feed.xml');
  writeFileSync(feed, feedXml(items));
  return feed;
}

function runBranch(repo, parent, args, env = {}) {
  const resultFile = join(parent, 'result.json');
  try {
    execFileSync(process.execPath, [script, '--repo', repo, '--base-ref', 'main', '--result-file', resultFile, ...args], {
      cwd: repo,
      encoding: 'utf8',
      env: { ...process.env, GEMINI_API_KEY: '', ...env },
    });
  } catch (error) {
    const failure = new Error(`${error.stderr ?? ''}\n${error.stdout ?? ''}`);
    failure.status = error.status;
    throw failure;
  }
  return JSON.parse(readFileSync(resultFile, 'utf8'));
}

test('findNewNewsStubs rejects modifications and deletions', () => {
  const parent = mkdtempSync(join(tmpdir(), 'rss-diff-'));
  const base = join(parent, 'base');
  const imported = join(parent, 'imported');
  mkdirSync(join(base, 'src/content/news'), { recursive: true });
  mkdirSync(join(imported, 'src/content/news'), { recursive: true });
  writeFileSync(join(base, 'src/content/news/keep.md'), 'same\n');
  writeFileSync(join(imported, 'src/content/news/keep.md'), 'same\n');
  writeFileSync(join(imported, 'src/content/news/2026-08-04-new.md'), 'new\n');
  assert.deepEqual(
    findNewNewsStubs(base, imported).map((file) => file.rel),
    ['src/content/news/2026-08-04-new.md'],
  );

  writeFileSync(join(imported, 'src/content/news/keep.md'), 'changed\n');
  assert.throws(() => findNewNewsStubs(base, imported), /modified existing content/);
  writeFileSync(join(imported, 'src/content/news/keep.md'), 'same\n');
  writeFileSync(join(base, 'src/content/news/gone.md'), 'gone\n');
  assert.throws(() => findNewNewsStubs(base, imported), /removed existing content/);
});

test('known campaigns produce no branch and no commit', () => {
  const { parent, repo } = initRepo();
  const before = git(repo, ['rev-parse', 'HEAD']).trim();
  const feed = writeFeed(parent, [KNOWN_ITEM]);
  const result = runBranch(repo, parent, ['--file', feed]);

  assert.equal(result.result, 'noop');
  assert.equal(git(repo, ['rev-parse', 'HEAD']).trim(), before);
  assert.equal(git(repo, ['status', '--porcelain']).trim(), '');
  assert.equal(git(repo, ['branch', '--list', 'automation/mailchimp-rss-stubs']).trim(), '');
  assert.equal(readFileSync(join(repo, 'src/content/news/2026-01-01-existing.md'), 'utf8'), EXISTING);
});

test('a new campaign is committed once and a repeated run does not duplicate it', () => {
  const { parent, repo } = initRepo();
  const feed = writeFeed(parent, [KNOWN_ITEM, POTLUCK]);
  const first = runBranch(repo, parent, ['--file', feed]);
  const branchTip = git(repo, ['rev-parse', 'automation/mailchimp-rss-stubs']).trim();
  const stub = git(repo, ['show', `${branchTip}:${POTLUCK_PATH}`]);

  assert.equal(first.result, 'committed');
  assert.deepEqual(first.files, [POTLUCK_PATH]);
  assert.match(stub, /draft: true/);
  assert.match(stub, /mailchimpArchiveUrl: https:\/\/mailchi\.mp\/bbbbbbbbbbbbbbbb\/neighborhood-potluck/);
  assert.equal(readFileSync(join(repo, 'src/content/news/2026-01-01-existing.md'), 'utf8'), EXISTING);
  assert.equal(git(repo, ['diff-tree', '--no-commit-id', '--name-status', '-r', branchTip]).trim(), `A\t${POTLUCK_PATH}`);

  const second = runBranch(repo, parent, ['--file', feed]);
  assert.equal(second.result, 'needs-pr');
  assert.equal(git(repo, ['rev-parse', 'automation/mailchimp-rss-stubs']).trim(), branchTip);
  assert.equal(git(repo, ['show', `${branchTip}:${POTLUCK_PATH}`]), stub);

  const third = runBranch(repo, parent, ['--file', feed, '--open-pr', 'true']);
  assert.equal(third.result, 'noop');
  assert.equal(git(repo, ['rev-parse', 'automation/mailchimp-rss-stubs']).trim(), branchTip);
  assert.equal(git(repo, ['show', `${branchTip}:${POTLUCK_PATH}`]), stub);
});

test('an open pull request with no remaining diff is marked close-empty', () => {
  const { parent, repo } = initRepo();
  git(repo, ['branch', 'automation/mailchimp-rss-stubs']);
  const feed = writeFeed(parent, [KNOWN_ITEM]);
  const result = runBranch(repo, parent, ['--file', feed, '--open-pr', 'true']);
  assert.equal(result.result, 'close-empty');
  assert.equal(git(repo, ['rev-parse', 'HEAD']).trim(), git(repo, ['rev-parse', 'main']).trim());
});

test('empty and non-RSS feeds do not change the checkout', () => {
  const { parent, repo } = initRepo();
  const before = git(repo, ['rev-parse', 'HEAD']).trim();
  const emptyFeed = join(parent, 'empty.xml');
  writeFileSync(emptyFeed, '<?xml version="1.0"?><rss version="2.0"><channel></channel></rss>\n');
  const empty = runBranch(repo, parent, ['--file', emptyFeed]);
  assert.equal(empty.result, 'noop');

  const html = join(parent, 'bad.html');
  writeFileSync(html, '<html><body>sign in</body></html>');
  assert.throws(() => runBranch(repo, parent, ['--file', html]), /not an RSS feed/);
  assert.equal(git(repo, ['rev-parse', 'HEAD']).trim(), before);
  assert.equal(readFileSync(join(repo, 'src/content/news/2026-01-01-existing.md'), 'utf8'), EXISTING);
  assert.equal(git(repo, ['status', '--porcelain']).trim(), '');
});

test('a partial import failure does not commit the stubs that were written first', () => {
  const { parent, repo } = initRepo();
  const before = git(repo, ['rev-parse', 'HEAD']).trim();
  const feed = writeFeed(parent, [
    POTLUCK,
    {
      title: 'Missing date',
      link: 'https://mailchi.mp/dddddddddddddddd/missing-date',
    },
  ]);

  assert.throws(() => runBranch(repo, parent, ['--file', feed]), /failed to create stub/);
  assert.equal(git(repo, ['rev-parse', 'HEAD']).trim(), before);
  assert.equal(git(repo, ['status', '--porcelain']).trim(), '');
  assert.throws(() => readFileSync(join(repo, POTLUCK_PATH), 'utf8'));
});

test('an open review branch keeps human edits and a deleted stub stays deleted', () => {
  const { parent, repo } = initRepo();
  const feed = writeFeed(parent, [POTLUCK]);
  runBranch(repo, parent, ['--file', feed]);

  git(repo, ['switch', 'automation/mailchimp-rss-stubs']);
  const stubPath = join(repo, POTLUCK_PATH);
  writeFileSync(stubPath, readFileSync(stubPath, 'utf8').replace(/\n$/, '\n\nHuman note.\n'));
  git(repo, ['add', POTLUCK_PATH]);
  git(repo, [
    '-c',
    'user.name=Human Reviewer',
    '-c',
    'user.email=human@example.com',
    '-c',
    'commit.gpgsign=false',
    'commit',
    '-m',
    'Fill the stub',
  ]);
  const edited = readFileSync(stubPath, 'utf8');
  git(repo, ['switch', 'main']);

  const withEdit = runBranch(repo, parent, ['--file', feed, '--open-pr', 'true']);
  assert.equal(withEdit.result, 'noop');
  git(repo, ['switch', 'automation/mailchimp-rss-stubs']);
  assert.equal(readFileSync(stubPath, 'utf8'), edited);
  git(repo, ['switch', 'main']);

  git(repo, ['switch', 'automation/mailchimp-rss-stubs']);
  git(repo, ['rm', POTLUCK_PATH]);
  git(repo, [
    '-c',
    'user.name=Human Reviewer',
    '-c',
    'user.email=human@example.com',
    '-c',
    'commit.gpgsign=false',
    'commit',
    '-m',
    'Drop this stub',
  ]);
  git(repo, ['switch', 'main']);

  const walk = {
    title: 'Creek walk',
    link: 'https://mailchi.mp/eeeeeeeeeeeeeeee/creek-walk',
    pubDate: 'Thu, 06 Aug 2026 15:00:00 +0000',
  };
  const nextFeed = writeFeed(parent, [POTLUCK, walk]);
  const added = runBranch(repo, parent, ['--file', nextFeed, '--open-pr', 'true']);
  assert.equal(added.result, 'committed');
  assert.deepEqual(added.files, [
    POTLUCK_PATH,
    'src/content/news/2026-08-06-creek-walk.md',
  ]);
  git(repo, ['switch', 'automation/mailchimp-rss-stubs']);
  assert.equal(readFileSync(join(repo, 'src/content/news/2026-08-06-creek-walk.md'), 'utf8').includes('draft: true'), true);
  assert.throws(() => readFileSync(stubPath, 'utf8'));
  git(repo, ['switch', 'main']);

  assert.throws(() => runBranch(repo, parent, ['--file', nextFeed, '--open-pr', 'false']), /Refusing to overwrite/);
  git(repo, ['switch', 'automation/mailchimp-rss-stubs']);
  assert.throws(() => readFileSync(stubPath, 'utf8'));
  assert.equal(
    git(repo, ['log', '-1', '--format=%s']).trim(),
    'Add Mailchimp campaign draft stubs',
  );
});

test('content check failure rolls back and leaves the default branch clean', () => {
  const { parent, repo } = initRepo();
  const before = git(repo, ['rev-parse', 'HEAD']).trim();
  const feed = writeFeed(parent, [POTLUCK]);

  assert.throws(
    () => runBranch(repo, parent, ['--file', feed], { RSS_STUBS_VALIDATE: 'fail' }),
    /content check failed/,
  );
  assert.equal(git(repo, ['rev-parse', 'HEAD']).trim(), before);
  assert.equal(git(repo, ['status', '--porcelain']).trim(), '');
  assert.equal(git(repo, ['branch', '--list', 'automation/mailchimp-rss-stubs']).trim(), '');
  assert.equal(readFileSync(join(repo, 'src/content/news/2026-01-01-existing.md'), 'utf8'), EXISTING);
});

test('a dirty work tree is refused', () => {
  const { parent, repo } = initRepo();
  writeFileSync(join(repo, 'src/content/news/2026-01-01-existing.md'), `${EXISTING}\nExtra.\n`);
  const feed = writeFeed(parent, [POTLUCK]);
  assert.throws(() => runBranch(repo, parent, ['--file', feed]), /dirty work tree/);
  assert.match(readFileSync(join(repo, 'src/content/news/2026-01-01-existing.md'), 'utf8'), /Extra\./);
});

test('merging the default branch into an open review branch stops on conflict', () => {
  const { parent, repo } = initRepo();
  const feed = writeFeed(parent, [POTLUCK]);
  runBranch(repo, parent, ['--file', feed]);

  writeFileSync(join(repo, 'src/content/news/2026-01-01-existing.md'), EXISTING.replace('Keep this body.', 'Main edit.'));
  git(repo, ['add', 'src/content/news/2026-01-01-existing.md']);
  git(repo, ['commit', '-m', 'Edit on main']);

  git(repo, ['switch', 'automation/mailchimp-rss-stubs']);
  writeFileSync(join(repo, 'src/content/news/2026-01-01-existing.md'), EXISTING.replace('Keep this body.', 'Branch edit.'));
  git(repo, ['add', 'src/content/news/2026-01-01-existing.md']);
  git(repo, [
    '-c',
    'user.name=Human Reviewer',
    '-c',
    'user.email=human@example.com',
    '-c',
    'commit.gpgsign=false',
    'commit',
    '-m',
    'Edit on the review branch',
  ]);
  const branchTip = git(repo, ['rev-parse', 'HEAD']).trim();
  git(repo, ['switch', 'main']);

  assert.throws(() => runBranch(repo, parent, ['--file', feed, '--open-pr', 'true']), /conflicted/);
  assert.equal(git(repo, ['rev-parse', 'automation/mailchimp-rss-stubs']).trim(), branchTip);
  assert.equal(git(repo, ['status', '--porcelain']).trim(), '');
  assert.doesNotMatch(git(repo, ['status']).trim(), /Unmerged|merging/i);
  git(repo, ['switch', 'automation/mailchimp-rss-stubs']);
  assert.match(readFileSync(join(repo, 'src/content/news/2026-01-01-existing.md'), 'utf8'), /Branch edit\./);
});
