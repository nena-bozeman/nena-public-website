/**
 * Geocode `address` in each business frontmatter and print or write lat/lng.
 *
 * Requires the Geocoding API enabled and a key that is NOT limited to “HTTP referrers”:
 *   - The Geocoding API is called from Node (server-style HTTP), not from a browser. Google does not
 *     apply Vite/localhost referrers here; a key restricted to http://localhost:4321/* will fail with
 *     “API keys with referer restrictions cannot be used with this API.”
 *   - Use GOOGLE_MAPS_GEOCODE_KEY: a separate key with Application restrictions = IP addresses (your
 *     public IP) or None, and API restrictions = Geocoding API.
 *   - Keep PUBLIC_GOOGLE_MAPS_API_KEY for the embedded map (HTTP referrers: production + localhost).
 *
 * Usage:
 *   node scripts/geocode-business-addresses.mjs            # dry-run: only businesses missing lat/lng
 *   node scripts/geocode-business-addresses.mjs --write  # add/update lat & lng in frontmatter
 *   node scripts/geocode-business-addresses.mjs --all      # include rows that already have coordinates (re-geocode)
 *
 * @see https://developers.google.com/maps/documentation/geocoding/requests-geocoding
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');

/**
 * `pnpm geocode:businesses` runs plain Node, which does not load `.env` like Vite does.
 * Parse `.env` then `.env.local` (local overrides base for duplicate keys). Shell env still wins: we
 * only fill `process.env[k]` when it is unset, same idea as `dotenv`.
 */
function loadEnvFiles() {
  const fromFiles = new Map();
  for (const name of ['.env', '.env.local']) {
    const p = path.join(repoRoot, name);
    if (!fs.existsSync(p)) continue;
    const text = fs.readFileSync(p, 'utf8');
    for (const line of text.split(/\r?\n/)) {
      const t = line.trim();
      if (!t || t.startsWith('#')) continue;
      const eq = t.indexOf('=');
      if (eq <= 0) continue;
      const k = t.slice(0, eq).trim();
      if (!k) continue;
      let v = t.slice(eq + 1).trim();
      if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
        v = v.slice(1, -1);
      }
      fromFiles.set(k, v);
    }
  }
  for (const [k, v] of fromFiles) {
    if (process.env[k] === undefined) process.env[k] = v;
  }
}
loadEnvFiles();

const contentDir = path.join(__dirname, '../src/content/businesses');
const SLEEP_MS = 220;
const key =
  (process.env.GOOGLE_MAPS_GEOCODE_KEY && process.env.GOOGLE_MAPS_GEOCODE_KEY.trim()) ||
  (process.env.PUBLIC_GOOGLE_MAPS_API_KEY && process.env.PUBLIC_GOOGLE_MAPS_API_KEY.trim());

const write = process.argv.includes('--write');
const forceAll = process.argv.includes('--all');

let printedReferrerKeyHelp = false;
let printedExpiredKeyHelp = false;

function maybePrintReferrerKeyHelp(err) {
  const s = String(err);
  if (printedReferrerKeyHelp || !/referer|referrer/i.test(s)) return;
  printedReferrerKeyHelp = true;
  console.error('\n' + '='.repeat(72));
  console.error(
    'This script calls the Geocoding API from Node, not from a browser. Keys restricted to\n' +
      '"HTTP referrers" (e.g. http://localhost:4321 for Vite) only work for the Maps JavaScript API\n' +
      'in the browser. They cannot be used for server/CLI Geocoding requests.\n\n' +
      'What to do:\n' +
      '  1. Google Cloud Console → APIs & Services → Credentials → Create API key (or duplicate).\n' +
      '  2. Application restrictions: use "IP addresses" and add your current public IP (search "what is my ip"),\n' +
      '     or "None" for local-only runs (less secure).\n' +
      '  3. API restrictions: Restrict key → enable "Geocoding API" (and only what you need).\n' +
      '  4. Put that key in .env as GOOGLE_MAPS_GEOCODE_KEY.\n' +
      '  5. Leave PUBLIC_GOOGLE_MAPS_API_KEY as your browser map key (HTTP referrers for prod + localhost).\n',
  );
  console.error('='.repeat(72) + '\n');
}

function maybePrintExpiredKeyHelp(err) {
  const s = String(err);
  if (printedExpiredKeyHelp || !/expired/i.test(s)) return;
  printedExpiredKeyHelp = true;
  console.error('\n' + '='.repeat(72));
  console.error(
    'Google says this API key is expired or no longer valid. That is enforced in Cloud Console,\n' +
      'not in this repo. Common fixes:\n' +
      '  • In Credentials, open the key and confirm you copied the full value into GOOGLE_MAPS_GEOCODE_KEY\n' +
      '    (no extra quotes, spaces, or line breaks). Regenerate the key and paste the new one if unsure.\n' +
      '  • Use a key from the same project where Geocoding API is enabled and billing is on.\n' +
      '  • If the key was deleted or restricted in a way that invalidates it, create a new API key.\n' +
      '  • Wait 1–2 minutes after creating a new key, then run the script again.\n',
  );
  console.error('='.repeat(72) + '\n');
}

function parseFile(content) {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m) return null;
  return { data: yaml.load(m[1]), body: m[2], head: m[1] };
}

function roundCoord(n) {
  return Math.round(n * 1e6) / 1e6;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function geocodeAddress(address) {
  const full = /bozeman|5971[0-9]/i.test(String(address)) ? String(address) : `${address}, Bozeman, MT`;
  const u =
    'https://maps.googleapis.com/maps/api/geocode/json?' +
    new URLSearchParams({ address: full, key });
  const res = await fetch(u);
  const j = await res.json();
  if (j.status !== 'OK' || !j.results?.[0]) {
    return {
      err: j.error_message || j.status,
      full,
    };
  }
  const loc = j.results[0].geometry.location;
  return {
    lat: roundCoord(loc.lat),
    lng: roundCoord(loc.lng),
    full,
    formatted: j.results[0].formatted_address,
  };
}

function replaceFrontmatterLatLng(content, lat, lng) {
  const m2 = content.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/);
  if (!m2) return content;
  let head = m2[1];
  const body = m2[2];
  const latLine = `lat: ${lat}`;
  const lngLine = `lng: ${lng}`;
  if (/^lat:\s*[-0-9.]+/m.test(head) && /^lng:\s*[-0-9.]+/m.test(head)) {
    head = head.replace(/^lat:\s*[-0-9.]+/m, latLine).replace(/^lng:\s*[-0-9.]+/m, lngLine);
  } else {
    head = `${head.trimEnd()}\n${latLine}\n${lngLine}`;
  }
  return `---\n${head}\n---\n${body}`;
}

const files = fs.readdirSync(contentDir).filter((f) => f.endsWith('.md'));

if (!key) {
  console.error('Missing GOOGLE_MAPS_GEOCODE_KEY or PUBLIC_GOOGLE_MAPS_API_KEY in the environment.');
  process.exit(1);
}

if (!write) {
  console.log(
    'Dry run (no files changed). By default only businesses missing lat/lng are geocoded. Use --all to re-geocode every open listing.\n',
  );
}

let errors = 0;
let skippedHasCoords = 0;
for (const f of files.sort()) {
  const fullPath = path.join(contentDir, f);
  const content = fs.readFileSync(fullPath, 'utf8');
  const parsed = parseFile(content);
  if (!parsed || !parsed.data) {
    console.warn('Skip (no frontmatter):', f);
    continue;
  }
  const { data } = parsed;
  if (data.status === 'closed') {
    continue;
  }
  if (!data.address) {
    console.warn('Skip (no address):', f);
    continue;
  }
  if (
    !forceAll &&
    typeof data.lat === 'number' &&
    typeof data.lng === 'number' &&
    !Number.isNaN(data.lat) &&
    !Number.isNaN(data.lng)
  ) {
    skippedHasCoords++;
    continue;
  }
  const r = await geocodeAddress(data.address);
  await sleep(SLEEP_MS);
  if (r.err) {
    maybePrintReferrerKeyHelp(r.err);
    maybePrintExpiredKeyHelp(r.err);
    console.error(f, r.err, r.full);
    errors++;
    continue;
  }
  const was = [data.lat, data.lng].every((v) => typeof v === 'number') ? `(${data.lat}, ${data.lng})` : '(none)';
  const delta = typeof data.lat === 'number' && typeof data.lng === 'number'
    ? Math.hypot(r.lat - data.lat, r.lng - data.lng)
    : null;
  console.log(
    [f, data.name, was, '->', `(${r.lat}, ${r.lng})`, delta != null ? `Δ≈${(delta * 111_000).toFixed(0)}m` : ''].join(' '),
  );
  if (r.formatted) {
    console.log('   ', r.formatted);
  }
  if (write) {
    const out = replaceFrontmatterLatLng(content, r.lat, r.lng);
    if (out === content) {
      console.warn('   (no change written: could not find lat/lng lines — add them manually once)');
    } else {
      fs.writeFileSync(fullPath, out, 'utf8');
    }
  }
}

if (!forceAll && skippedHasCoords > 0) {
  console.log(
    '\nSkipped ' + skippedHasCoords + ' file(s) that already have lat/lng. Use --all to re-geocode them.',
  );
}

if (write && errors) {
  process.exit(1);
}
