import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Plain Node scripts do not load `.env` like Vite/Astro does.
 * Parse `.env` then `.env.local` (local overrides base for duplicate keys).
 * Shell env still wins: only fill process.env[k] when unset.
 *
 * @param {string} repoRoot
 */
export function loadEnvFiles(repoRoot) {
  /** @type {Map<string, string>} */
  const fromFiles = new Map();

  for (const name of ['.env', '.env.local']) {
    const filePath = join(repoRoot, name);
    if (!existsSync(filePath)) continue;

    const text = readFileSync(filePath, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const eq = trimmed.indexOf('=');
      if (eq <= 0) continue;

      const key = trimmed.slice(0, eq).trim();
      if (!key) continue;

      let value = trimmed.slice(eq + 1).trim();
      if (
        (value.startsWith('"') && value.endsWith('"'))
        || (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1);
      }

      fromFiles.set(key, value);
    }
  }

  for (const [key, value] of fromFiles) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}
