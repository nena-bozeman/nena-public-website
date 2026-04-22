/**
 * Download a social/hero image for each business from its public website (og:image or twitter:image).
 * Saves to src/assets/businesses/<slug>.<ext> for use with getBusinessCoverImage().
 *
 * Usage:
 *   node scripts/fetch-business-hero-images.mjs           # skip slugs that already have an image file
 *   node scripts/fetch-business-hero-images.mjs --force  # overwrite existing files
 *   node scripts/fetch-business-hero-images.mjs --dry-run
 *
 * Verify each business is OK with using their site imagery; prefer photos you own when in doubt.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import yaml from 'js-yaml';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.join(__dirname, '..');
const contentDir = path.join(repoRoot, 'src/content/businesses');
const outDir = path.join(repoRoot, 'src/assets/businesses');

const UA =
  'Mozilla/5.0 (compatible; NENA-directory/1.0; +https://nena-bozeman.github.io/nena-public-website/)';

const force = process.argv.includes('--force');
const dryRun = process.argv.includes('--dry-run');

function parseFrontmatter(content) {
  const m = content.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!m) return null;
  return yaml.load(m[1]);
}

function extractSocialImageUrl(html, pageUrl) {
  const candidates = [
    /<meta[^>]+property=["']og:image:secure_url["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image:secure_url["']/i,
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+content=["']([^"']+)["'][^>]+name=["']twitter:image["']/i,
  ];
  for (const re of candidates) {
    const m = html.match(re);
    if (m?.[1]) {
      const raw = m[1].trim();
      if (raw.startsWith('data:')) continue;
      try {
        return new URL(raw, pageUrl).href;
      } catch {
        /* skip */
      }
    }
  }
  return null;
}

function extFromType(ct, imageUrl) {
  const t = (ct || '').split(';')[0].trim().toLowerCase();
  if (t.includes('jpeg') || t.includes('jpg')) return 'jpg';
  if (t.includes('png')) return 'png';
  if (t.includes('webp')) return 'webp';
  if (t.includes('gif')) return 'gif';
  const u = imageUrl.toLowerCase();
  if (u.includes('.jpg') || u.includes('.jpeg')) return 'jpg';
  if (u.includes('.png')) return 'png';
  if (u.includes('.webp')) return 'webp';
  return 'jpg';
}

function existingImagePaths(slug) {
  if (!fs.existsSync(outDir)) return [];
  return fs.readdirSync(outDir).filter((f) => f.startsWith(slug + '.'));
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const SLEEP_PAGE_MS = 600;

if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

const files = fs.readdirSync(contentDir).filter((f) => f.endsWith('.md'));
let ok = 0;
let skip = 0;
let fail = 0;

for (const f of files.sort()) {
  const slug = f.replace(/\.md$/, '');
  const fullPath = path.join(contentDir, f);
  const content = fs.readFileSync(fullPath, 'utf8');
  const data = parseFrontmatter(content);
  if (!data?.website) {
    continue;
  }

  if (!force && existingImagePaths(slug).length > 0) {
    console.log('skip (exists):', slug, existingImagePaths(slug).join(', '));
    skip++;
    continue;
  }

  const pageUrl = data.website.trim();
  if (dryRun) {
    console.log('would fetch:', slug, pageUrl);
    continue;
  }

  let html;
  try {
    const r = await fetch(pageUrl, {
      headers: { 'User-Agent': UA, Accept: 'text/html,application/xhtml+xml' },
      redirect: 'follow',
    });
    if (!r.ok) {
      console.error(slug, 'page HTTP', r.status, pageUrl);
      fail++;
      await sleep(SLEEP_PAGE_MS);
      continue;
    }
    html = await r.text();
  } catch (e) {
    console.error(slug, 'page fetch', e.message);
    fail++;
    await sleep(SLEEP_PAGE_MS);
    continue;
  }

  const imageUrl = extractSocialImageUrl(html, pageUrl);
  if (!imageUrl) {
    console.error(slug, 'no og:image / twitter:image found');
    fail++;
    await sleep(SLEEP_PAGE_MS);
    continue;
  }

  let buf;
  let ext;
  try {
    const ir = await fetch(imageUrl, {
      headers: { 'User-Agent': UA, Accept: 'image/*,*/*' },
      redirect: 'follow',
    });
    if (!ir.ok) {
      console.error(slug, 'image HTTP', ir.status, imageUrl);
      fail++;
      await sleep(SLEEP_PAGE_MS);
      continue;
    }
    ext = extFromType(ir.headers.get('content-type'), imageUrl);
    const ab = await ir.arrayBuffer();
    buf = Buffer.from(ab);
  } catch (e) {
    console.error(slug, 'image fetch', e.message, imageUrl);
    fail++;
    await sleep(SLEEP_PAGE_MS);
    continue;
  }

  if (buf.length < 500) {
    console.error(slug, 'image too small, skipping', buf.length, 'bytes');
    fail++;
    await sleep(SLEEP_PAGE_MS);
    continue;
  }

  const outPath = path.join(outDir, `${slug}.${ext}`);
  fs.writeFileSync(outPath, buf);
  console.log('wrote', slug, '←', imageUrl, `(${buf.length} bytes) →`, path.basename(outPath));
  ok++;
  await sleep(SLEEP_PAGE_MS);
}

console.log(
  '\nDone. ok=' + ok + ' skip=' + skip + ' fail=' + fail + (dryRun ? ' (dry-run)' : '') + (force ? ' (force)' : ''),
);
if (fail > 0) {
  process.exitCode = 1;
}
