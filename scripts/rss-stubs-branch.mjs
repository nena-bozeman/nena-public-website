#!/usr/bin/env node
/**
 * Run `rss-to-notes --write` against a copy of the default-branch content, then
 * commit only new draft news stubs onto the automation branch.
 *
 * The Mailchimp feed is data: this script never evaluates titles or HTML.
 * It does not push unless `--push` is set, and it does not call `gh`.
 * The workflow opens or updates the review pull request.
 *
 * Usage:
 *   node scripts/rss-stubs-branch.mjs \
 *     --base-ref origin/main \
 *     --branch-ref origin/automation/mailchimp-rss-stubs \
 *     --open-pr true \
 *     --push \
 *     --result-file /tmp/rss-stubs.json \
 *     --pr-body-file /tmp/rss-stubs-pr-body.md
 */

import { execFileSync } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  statSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import yaml from 'js-yaml';
import {
  enrichDraftMarkdown,
  GEMINI_API_KEY_ENV,
  shouldRequestSummary,
} from './lib/mailchimp-campaign-summary.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SCRIPT_REPO = join(__dirname, '..');

export const AUTOMATION_BRANCH = 'automation/mailchimp-rss-stubs';
export const COMMIT_SUBJECT = 'Add Mailchimp campaign draft stubs';
export const BOT_NAME = 'github-actions[bot]';
export const BOT_EMAIL = '41898282+github-actions[bot]@users.noreply.github.com';

const NEWS_PREFIX = 'src/content/news/';
const STUB_PATH_RE = /^src\/content\/news\/\d{4}-\d{2}-\d{2}-[a-z0-9-]+\.md$/;
const ARCHIVE_URL_RE = /^https:\/\/mailchi\.mp\/[A-Za-z0-9]+\/[A-Za-z0-9-]+$/;
const STUB_FRONTMATTER_KEYS = new Set([
  'title',
  'date',
  'summary',
  'featured',
  'draft',
  'tags',
  'topics',
  'mailchimpArchiveUrl',
]);
const BOT_GIT_CONFIG = [
  '-c',
  `user.name=${BOT_NAME}`,
  '-c',
  `user.email=${BOT_EMAIL}`,
  '-c',
  'commit.gpgsign=false',
];

/**
 * @param {string} repo
 * @param {string[]} args
 * @param {{ env?: NodeJS.ProcessEnv, input?: string }} [opts]
 */
function git(repo, args, opts = {}) {
  return execFileSync('git', args, {
    cwd: repo,
    encoding: 'utf8',
    input: opts.input,
    env: { ...process.env, ...opts.env },
    stdio: ['pipe', 'pipe', 'pipe'],
  });
}

/**
 * @param {string} repo
 * @param {string} branchRef
 * @param {string} rel
 * @returns {string | null}
 */
function existingBranchFile(repo, branchRef, rel) {
  if (!refExists(repo, branchRef)) return null;
  try {
    return git(repo, ['show', `${branchRef}:${rel}`]);
  } catch {
    return null;
  }
}

/**
 * Keep a file already on the automation branch. Summarize only a new bare stub.
 * An existing file is not rewritten, so a human edit stays put.
 *
 * @param {string} repo
 * @param {string} branchRef
 * @param {{ rel: string, content: string }[]} stubs
 * @param {string} apiKey
 */
async function prepareStubContents(repo, baseRef, branchRef, stubs, apiKey) {
  /** @type {{ rel: string, content: string, summarized: boolean }[]} */
  const prepared = [];
  for (const stub of stubs) {
    const existing = existingBranchFile(repo, branchRef, stub.rel);
    const deleted = deletedOnBranchRef(repo, baseRef, branchRef, stub.rel);
    if (!shouldRequestSummary({ existing, deleted })) {
      prepared.push({ ...stub, content: existing ?? stub.content, summarized: false });
      continue;
    }
    const enriched = await enrichDraftMarkdown(stub.content, { apiKey });
    let content = stub.content;
    let summarized = false;
    if (enriched.summarized) {
      try {
        assertDraftStub(stub.rel, enriched.markdown, new Set(), { allowBody: true });
        content = enriched.markdown;
        summarized = true;
      } catch (error) {
        console.error(
          `rss-stubs-branch: keeping bare stub for ${stub.rel} (${error instanceof Error ? error.message : error})`,
        );
      }
    } else if (apiKey.trim()) {
      console.error(`rss-stubs-branch: bare stub for ${stub.rel} (${enriched.reason})`);
    }
    prepared.push({ ...stub, content, summarized });
  }
  return prepared;
}

function deletedOnBranchRef(repo, baseRef, branchRef, rel) {
  if (!refExists(repo, branchRef)) return false;
  const deleted = git(repo, [
    'log',
    '--diff-filter=D',
    '--name-only',
    '--format=',
    `${baseRef}..${branchRef}`,
    '--',
    rel,
  ]).trim();
  return deleted.length > 0;
}

function refExists(repo, ref) {
  try {
    git(repo, ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`]);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {string} root
 * @returns {Map<string, Buffer>}
 */
function contentFiles(root) {
  /** @type {Map<string, Buffer>} */
  const files = new Map();
  const contentRoot = join(root, 'src/content');
  if (!existsSync(contentRoot)) return files;

  /** @param {string} dir */
  function walk(dir) {
    for (const name of readdirSync(dir)) {
      const path = join(dir, name);
      const info = statSync(path);
      if (info.isDirectory()) {
        walk(path);
      } else if (info.isFile()) {
        const rel = relative(root, path).split('\\').join('/');
        files.set(rel, readFileSync(path));
      }
    }
  }

  walk(contentRoot);
  return files;
}

/**
 * New `src/content/news/*.md` files created by an import.
 * Modifications and deletions are errors so a bad run cannot replace content.
 *
 * @param {string} baseRoot
 * @param {string} importedRoot
 * @returns {{ rel: string, content: string }[]}
 */
export function findNewNewsStubs(baseRoot, importedRoot) {
  const base = contentFiles(baseRoot);
  const imported = contentFiles(importedRoot);
  /** @type {{ rel: string, content: string }[]} */
  const additions = [];

  for (const [rel, buf] of imported) {
    const before = base.get(rel);
    if (!before) {
      if (!rel.startsWith(NEWS_PREFIX)) {
        throw new Error(`Import created an unexpected path: ${rel}`);
      }
      additions.push({ rel, content: buf.toString('utf8') });
      continue;
    }
    if (!before.equals(buf)) {
      throw new Error(`Import modified existing content: ${rel}`);
    }
  }

  for (const rel of base.keys()) {
    if (!imported.has(rel)) {
      throw new Error(`Import removed existing content: ${rel}`);
    }
  }

  additions.sort((a, b) => a.rel.localeCompare(b.rel));
  return additions;
}

/**
 * @param {string} root
 * @returns {Set<string>}
 */
function knownCampaignIds(root) {
  /** @type {Set<string>} */
  const ids = new Set();
  for (const dir of ['news', 'events']) {
    const abs = join(root, 'src/content', dir);
    if (!existsSync(abs)) continue;
    for (const name of readdirSync(abs)) {
      if (!name.endsWith('.md')) continue;
      const text = readFileSync(join(abs, name), 'utf8');
      for (const match of text.matchAll(/mailchi\.mp\/([^/?#\s"'<>]+)/gi)) {
        ids.add(match[1].toLowerCase());
      }
    }
  }
  return ids;
}

/**
 * @param {string} rel
 * @param {string} content
 * @param {Set<string>} knownIds
 * @returns {string}
 */
export function assertDraftStub(rel, content, knownIds, options = {}) {
  if (!STUB_PATH_RE.test(rel)) {
    throw new Error(`Unexpected stub path: ${rel}`);
  }
  const match = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!match) throw new Error(`${rel} is not a markdown stub`);
  const data = yaml.load(match[1]);
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new Error(`${rel} frontmatter is not a mapping`);
  }
  for (const key of Object.keys(data)) {
    if (!STUB_FRONTMATTER_KEYS.has(key)) {
      throw new Error(`${rel} has unexpected frontmatter ${key}`);
    }
  }
  if (!options.allowBody && match[2].trim() !== '') throw new Error(`${rel} body is not empty`);
  if (data.draft !== true) throw new Error(`${rel} is not a draft`);
  if (data.featured !== false) throw new Error(`${rel} featured is not false`);
  if (!Array.isArray(data.topics) || data.topics.length !== 0) {
    throw new Error(`${rel} topics are not empty`);
  }
  if (!Array.isArray(data.tags) || data.tags.length !== 0) {
    throw new Error(`${rel} tags are not empty`);
  }
  if (typeof data.mailchimpArchiveUrl !== 'string' || !ARCHIVE_URL_RE.test(data.mailchimpArchiveUrl)) {
    throw new Error(`${rel} archive URL is not a mailchi.mp link`);
  }
  const dateLine = match[1].match(/^date:\s*(.+)$/m);
  if (!dateLine || !/^'\d{4}-\d{2}-\d{2}'$/.test(dateLine[1].trim())) {
    throw new Error(`${rel} date is not a quoted YYYY-MM-DD`);
  }
  const id = data.mailchimpArchiveUrl.match(/mailchi\.mp\/([^/?#]+)/i)?.[1]?.toLowerCase();
  if (!id) throw new Error(`${rel} is missing a campaign id`);
  if (knownIds.has(id)) {
    throw new Error(`${rel} campaign ${id} is already in content`);
  }
  return id;
}

/**
 * @param {string} repo
 * @param {string} file
 */
function importIntoCopy(repo, file) {
  const tmp = mkdtempSync(join(tmpdir(), 'rss-stubs-import-'));
  const source = join(repo, 'src/content');
  if (!existsSync(source)) {
    rmSync(tmp, { recursive: true, force: true });
    throw new Error('missing src/content');
  }
  mkdirSync(join(tmp, 'src'), { recursive: true });
  cpSync(source, join(tmp, 'src/content'), { recursive: true });

  const args = [join(SCRIPT_REPO, 'scripts/rss-to-notes.mjs'), '--write', '--format', 'json'];
  if (file) args.push('--file', file);

  try {
    execFileSync(process.execPath, args, {
      cwd: repo,
      encoding: 'utf8',
      env: { ...process.env, RSS_TO_NOTES_ROOT: tmp },
      stdio: ['ignore', 'pipe', 'pipe'],
      maxBuffer: 8 * 1024 * 1024,
    });
  } catch (error) {
    const stderr = error && typeof error === 'object' && 'stderr' in error ? String(error.stderr ?? '') : '';
    const stdout = error && typeof error === 'object' && 'stdout' in error ? String(error.stdout ?? '') : '';
    rmSync(tmp, { recursive: true, force: true });
    const detail = (stderr || stdout || (error instanceof Error ? error.message : String(error))).trim();
    throw new Error(`rss-to-notes failed:\n${detail}`);
  }

  return tmp;
}

/**
 * @param {string} repo
 */
function runContentChecks(repo) {
  if (process.env.RSS_STUBS_VALIDATE === 'fail') {
    throw new Error('content check failed');
  }
  if (!existsSync(join(repo, 'package.json'))) {
    console.log('rss-stubs-branch: no package.json in this checkout; skipping content checks');
    return;
  }
  execFileSync('pnpm', ['run', 'check'], {
    cwd: repo,
    stdio: 'inherit',
  });
}

/**
 * @param {string} repo
 * @param {string} baseRef
 * @param {string} branchRef
 */
function hasNonBotCommits(repo, baseRef, branchRef) {
  const log = git(repo, ['log', '--format=%ae%x1f%ce', `${baseRef}..${branchRef}`]).trim();
  if (!log) return false;
  for (const line of log.split('\n')) {
    const [author, committer] = line.split('\u001f');
    if (author !== BOT_EMAIL || committer !== BOT_EMAIL) return true;
  }
  return false;
}

/**
 * @param {string} repo
 * @param {string} baseRef
 * @param {{ rel: string, content: string }[]} stubs
 */
function treeWithStubs(repo, baseRef, stubs) {
  const dir = mkdtempSync(join(tmpdir(), 'rss-index-'));
  const index = join(dir, 'index');
  const env = { GIT_INDEX_FILE: index };
  try {
    git(repo, ['read-tree', baseRef], { env });
    for (const stub of stubs) {
      const hash = git(repo, ['hash-object', '-w', '--stdin'], {
        env,
        input: stub.content,
      }).trim();
      git(repo, ['update-index', '--add', '--cacheinfo', `100644,${hash},${stub.rel}`], { env });
    }
    return git(repo, ['write-tree'], { env }).trim();
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/**
 * @param {string} repo
 * @param {string[]} paths
 */
function commitAddedPaths(repo, paths) {
  git(repo, ['add', '--', ...paths]);
  const cached = git(repo, ['diff', '--cached', '--name-status'])
    .trim()
    .split('\n')
    .filter(Boolean);
  if (cached.length !== paths.length) {
    throw new Error(`Refusing to commit unexpected staged changes:\n${cached.join('\n')}`);
  }
  for (const line of cached) {
    const [status, name] = line.split('\t');
    if (status !== 'A' || !paths.includes(name)) {
      throw new Error(`Refusing to commit ${line}`);
    }
  }
  const porcelain = git(repo, ['status', '--porcelain'])
    .trim()
    .split('\n')
    .filter(Boolean);
  for (const line of porcelain) {
    const status = line.slice(0, 2);
    const name = line.slice(3);
    if (!(status === 'A ' && paths.includes(name))) {
      throw new Error(`Work tree has unrelated changes: ${line}`);
    }
  }
  git(repo, [...BOT_GIT_CONFIG, 'commit', '-m', COMMIT_SUBJECT]);
}

/**
 * @param {string} repo
 * @param {string} path
 * @param {string} baseRef
 */
function deletedOnBranchSince(repo, path, baseRef) {
  const deleted = git(repo, [
    'log',
    '--diff-filter=D',
    '--name-only',
    '--format=',
    `${baseRef}..HEAD`,
    '--',
    path,
  ]).trim();
  return deleted.length > 0;
}

/**
 * @param {string} repo
 * @param {{
 *   beforeSha: string | null,
 *   createdBranch: boolean,
 *   branchName: string,
 *   startBranch: string,
 * }} state
 */
function rollback(repo, state) {
  let current = '';
  try {
    current = git(repo, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  } catch {
    current = '';
  }
  if (current === state.branchName) {
    try {
      git(repo, ['merge', '--abort']);
    } catch {
      // Not in a merge.
    }
    try {
      git(repo, ['reset', '--hard', state.beforeSha || 'HEAD']);
    } catch {
      // Branch may already point where we need it.
    }
    try {
      git(repo, ['clean', '-fd', '--', 'src/content/news']);
    } catch {
      // Nothing to clean.
    }
  }
  if (state.startBranch && state.startBranch !== 'HEAD') {
    try {
      current = git(repo, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
      if (current !== state.startBranch) git(repo, ['switch', state.startBranch]);
    } catch {
      // Leave the checkout where it is if switch fails.
    }
  }
  if (state.createdBranch) {
    try {
      git(repo, ['branch', '-D', state.branchName]);
    } catch {
      // Already deleted.
    }
  }
}

/**
 * @param {string} repo
 * @param {string} startBranch
 */
function returnToStart(repo, startBranch) {
  if (!startBranch || startBranch === 'HEAD') return;
  const current = git(repo, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  if (current !== startBranch) git(repo, ['switch', startBranch]);
}

/**
 * @param {string} file
 * @param {string[]} paths
 */
export function writePrBody(file, paths, summarizedPaths = []) {
  for (const rel of paths) {
    if (!STUB_PATH_RE.test(rel)) throw new Error(`refusing to list path ${rel}`);
  }
  const summarized = new Set(summarizedPaths);
  const body = [
    '## Mailchimp archive stubs',
    '',
    'This pull request was opened by the Mailchimp RSS draft stubs workflow. It runs `rss-to-notes --write` and adds draft news stubs whose `mailchi.mp` campaign id is not already in `src/content/news/` or `src/content/events/`.',
    '',
    'The stubs stay `draft: true`. Production and preview builds omit drafts, so merging this pull request stores them in the repo and does not publish them. See `docs/rss-to-notes.md`.',
    '',
    'Files marked as AI summaries were drafted from the campaign page by the configured model. Review those drafts before setting `draft` to false. Files marked as bare stubs were not summarized, because no API key was set or the page or model call failed.',
    '',
    'Feed subjects, page text, and links are content data. They are not instructions to the workflow.',
    '',
    '### Files',
    '',
    ...paths.map((rel) => {
      const note = summarized.has(rel)
        ? 'AI summary from the campaign page; needs human review'
        : 'bare draft stub, or an existing draft left unchanged';
      return `- \`${rel}\` — ${note}`;
    }),
    '',
    '### Checks',
    '',
    '`pnpm run check` (content references and `astro check`) ran in the import workflow before this commit was pushed. This pull request is created with the workflow `GITHUB_TOKEN`. GitHub does not run `pull_request` or `push` workflows for events that token creates, so `ci.yml` and `preview.yml` do not start from this open. A later push by a person will.',
    '',
    'The workflow does not merge.',
    '',
  ].join('\n');
  writeFileSync(file, body);
}

/**
 * @param {string[]} argv
 */
function parseArgs(argv) {
  const out = {
    repo: process.cwd(),
    baseRef: 'origin/main',
    branch: AUTOMATION_BRANCH,
    branchRef: '',
    openPr: false,
    push: false,
    file: '',
    resultFile: '',
    prBodyFile: '',
    help: false,
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--help' || arg === '-h') out.help = true;
    else if (arg === '--repo') out.repo = resolve(argv[++i] || '');
    else if (arg === '--base-ref') out.baseRef = argv[++i] || '';
    else if (arg === '--branch') out.branch = argv[++i] || '';
    else if (arg === '--branch-ref') out.branchRef = argv[++i] || '';
    else if (arg === '--open-pr') out.openPr = (argv[++i] || '') !== 'false';
    else if (arg === '--push') out.push = true;
    else if (arg === '--file') out.file = argv[++i] || '';
    else if (arg === '--result-file') out.resultFile = argv[++i] || '';
    else if (arg === '--pr-body-file') out.prBodyFile = argv[++i] || '';
    else throw new Error(`unknown argument ${arg}`);
  }
  if (!out.branchRef) out.branchRef = out.branch;
  return out;
}

/**
 * @param {string} repo
 * @param {string} branchName
 * @param {boolean} force
 */
function pushBranch(repo, branchName, force) {
  const args = ['push'];
  if (force) args.push('--force-with-lease');
  else args.push('--set-upstream');
  args.push('origin', `${branchName}:${branchName}`);
  git(repo, args);
}

/**
 * @param {ReturnType<typeof parseArgs>} args
 */
export async function updateAutomationBranch(args) {
  const { repo, baseRef, branch, branchRef, openPr, push, file } = args;
  const status = git(repo, ['status', '--porcelain']).trim();
  if (status) {
    throw new Error(`Refusing to run with a dirty work tree:\n${status}`);
  }
  if (!refExists(repo, baseRef)) {
    throw new Error(`Base ref not found: ${baseRef}`);
  }
  const head = git(repo, ['rev-parse', 'HEAD']).trim();
  const baseSha = git(repo, ['rev-parse', baseRef]).trim();
  if (head !== baseSha) {
    throw new Error(`Checkout HEAD is not ${baseRef}. Refusing to import from another branch.`);
  }

  const startBranch = git(repo, ['rev-parse', '--abbrev-ref', 'HEAD']).trim();
  const importedRoot = importIntoCopy(repo, file);
  /** @type {{ rel: string, content: string }[]} */
  let stubs;
  try {
    stubs = findNewNewsStubs(repo, importedRoot);
  } finally {
    rmSync(importedRoot, { recursive: true, force: true });
  }

  const knownIds = knownCampaignIds(repo);
  /** @type {Set<string>} */
  const seenIds = new Set();
  for (const stub of stubs) {
    const id = assertDraftStub(stub.rel, stub.content, knownIds);
    if (seenIds.has(id)) throw new Error(`Duplicate campaign id in import: ${id}`);
    seenIds.add(id);
    knownIds.add(id);
  }

  const prepared = await prepareStubContents(
    repo,
    baseRef,
    branchRef,
    stubs,
    process.env[GEMINI_API_KEY_ENV] ?? '',
  );
  const summarized = prepared.filter((stub) => stub.summarized).map((stub) => stub.rel);

  const branchExists = refExists(repo, branchRef);
  /** @type {'noop' | 'close-empty' | 'needs-pr' | 'committed'} */
  let result = 'noop';

  if (stubs.length === 0) {
    if (openPr && branchExists) {
      const diff = git(repo, ['diff', '--name-only', baseRef, branchRef]).trim();
      if (!diff) result = 'close-empty';
    }
    return { result, branch, files: /** @type {string[]} */ ([]), summarized: /** @type {string[]} */ ([]) };
  }

  if (openPr && !branchExists) {
    throw new Error(`An open pull request was reported, but ${branchRef} does not exist.`);
  }

  /** @type {{ beforeSha: string | null, createdBranch: boolean, branchName: string, startBranch: string }} */
  const state = {
    beforeSha: null,
    createdBranch: false,
    branchName: branch,
    startBranch,
  };

  try {
    if (openPr) {
      git(repo, ['switch', '-C', branch, branchRef]);
      state.beforeSha = git(repo, ['rev-parse', 'HEAD']).trim();
      try {
        git(repo, [...BOT_GIT_CONFIG, 'merge', '--no-edit', baseRef]);
      } catch (error) {
        const detail = error && typeof error === 'object' && 'stderr' in error ? String(error.stderr ?? '') : '';
        throw new Error(
          `Refusing to overwrite the open review branch: merging ${baseRef} conflicted.\n${detail.trim()}`,
        );
      }

      /** @type {string[]} */
      const added = [];
      for (const stub of stubs) {
        const dest = join(repo, stub.rel);
        if (existsSync(dest)) continue;
        if (deletedOnBranchSince(repo, stub.rel, baseRef)) continue;
        mkdirSync(dirname(dest), { recursive: true });
        const preparedStub = prepared.find((item) => item.rel === stub.rel) ?? stub;
        writeFileSync(dest, preparedStub.content, 'utf8');
        added.push(stub.rel);
      }

      if (added.length === 0) {
        const now = git(repo, ['rev-parse', 'HEAD']).trim();
        if (now !== state.beforeSha) git(repo, ['reset', '--hard', state.beforeSha]);
        git(repo, ['clean', '-fd', '--', 'src/content/news']);
      } else {
        runContentChecks(repo);
        commitAddedPaths(repo, added);
        if (push) pushBranch(repo, branch, false);
        result = 'committed';
      }
    } else {
      if (branchExists && hasNonBotCommits(repo, baseRef, branchRef)) {
        throw new Error(
          `${branch} has commits that were not made by this automation, and there is no open pull request. Refusing to overwrite them. Reopen the pull request or delete the branch.`,
        );
      }

      const desired = treeWithStubs(repo, baseRef, prepared);
      if (branchExists) {
        const currentTree = git(repo, ['rev-parse', `${branchRef}^{tree}`]).trim();
        if (currentTree === desired) {
          result = 'needs-pr';
        }
      }

      if (result !== 'needs-pr') {
        state.beforeSha = branchExists ? git(repo, ['rev-parse', branchRef]).trim() : null;
        state.createdBranch = !branchExists;
        git(repo, ['switch', '-C', branch, baseRef]);
        for (const stub of prepared) {
          const dest = join(repo, stub.rel);
          mkdirSync(dirname(dest), { recursive: true });
          writeFileSync(dest, stub.content, 'utf8');
        }
        runContentChecks(repo);
        commitAddedPaths(
          repo,
          prepared.map((stub) => stub.rel),
        );
        if (push) pushBranch(repo, branch, branchExists);
        result = 'committed';
        state.createdBranch = false;
      }
    }
  } catch (error) {
    rollback(repo, state);
    throw error;
  }

  returnToStart(repo, startBranch);
  return {
    result,
    branch,
    files: prepared.map((stub) => stub.rel),
    summarized,
  };
}

function printHelp() {
  console.log(`Update the Mailchimp RSS draft-stub branch.

Options:
  --repo <path>         Git checkout (default: cwd)
  --base-ref <ref>      Default branch ref to import from
  --branch <name>       Automation branch name
  --branch-ref <ref>    Existing tip (default: --branch)
  --open-pr <true|false>
  --push                Push the automation branch to origin
  --file <path>         Read RSS from a file instead of the network
  --result-file <path>  Write JSON { result, branch, files }
  --pr-body-file <path> Write the review pull request body
`);
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.help) {
    printHelp();
    return;
  }
  const outcome = await updateAutomationBranch(args);
  if (args.prBodyFile && (outcome.result === 'committed' || outcome.result === 'needs-pr')) {
    writePrBody(args.prBodyFile, outcome.files, outcome.summarized);
  }
  if (args.resultFile) {
    writeFileSync(args.resultFile, `${JSON.stringify(outcome, null, 2)}\n`);
  }
  if (process.env.GITHUB_OUTPUT) {
    writeFileSync(process.env.GITHUB_OUTPUT, `result=${outcome.result}\n`, { flag: 'a' });
  }
  console.log(`rss-stubs-branch: ${outcome.result} (${outcome.files.length} stub path(s))`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
