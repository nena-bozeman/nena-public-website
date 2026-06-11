#!/usr/bin/env node
/**
 * Ensure the installed lychee binary matches .lychee-version (same pin as CI).
 *
 * Usage: node scripts/check-lychee-version.mjs
 */

import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const expected = readFileSync(join(ROOT, '.lychee-version'), 'utf8').trim();

let output;
try {
  output = execFileSync('lychee', ['--version'], { encoding: 'utf8' });
} catch {
  console.error('lychee: command not found — install with `brew bundle` (see docs/link-checking.md)');
  process.exit(1);
}

const match = output.trim().match(/^lychee\s+(\S+)/);
const actual = match?.[1];
if (!actual) {
  console.error(`lychee: could not parse version from: ${output.trim()}`);
  process.exit(1);
}

if (actual !== expected) {
  console.error(`lychee version mismatch: expected ${expected}, got ${actual}`);
  console.error('CI and local dev use the version in .lychee-version — upgrade with `brew upgrade lychee` or install that release.');
  process.exit(1);
}
