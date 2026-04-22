/**
 * Pulls legacy "development watch" style pages from the local Docker MySQL
 * (nenabozeman_db) and writes src/content/development/*.md
 *
 * Prereq: data/docker/legacy-mysql up, .env with MYSQL_ROOT_PASSWORD, port 3307.
 * Uses root (migration tool); use nena_read for ad-hoc queries in README.
 */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import Turndown from 'turndown';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');
const envPath = join(root, 'data/docker/legacy-mysql/.env');

function loadEnv() {
  let text;
  try {
    text = readFileSync(envPath, 'utf8');
  } catch {
    console.error(`Missing ${envPath} (copy from .env.example)`);
    process.exit(1);
  }
  const out = {};
  for (const line of text.split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#')) continue;
    const i = t.indexOf('=');
    if (i === -1) continue;
    const k = t.slice(0, i).trim();
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    out[k] = v;
  }
  return out;
}

const turndown = new Turndown({ headingStyle: 'atx', codeBlockStyle: 'fenced' });

function htmlToSummary(html) {
  if (!html) return 'Content migrated from the legacy NENA site.';
  const t = html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&[a-z]+;/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (t.length <= 220) return t;
  return `${t.slice(0, 217).trimEnd()}…`;
}

function pageStatusToEnum(status) {
  const s = (status || '').toLowerCase();
  if (s === 'live') return 'proposed';
  if (s === 'draft') return 'under-review';
  return 'under-review';
}

async function main() {
  const env = loadEnv();
  const pass = env.MYSQL_ROOT_PASSWORD;
  if (!pass) {
    console.error('MYSQL_ROOT_PASSWORD is empty in .env');
    process.exit(1);
  }
  const port = Number.parseInt(env.NENA_MYSQL_PORT || '3307', 10);

  let conn;
  try {
    conn = await mysql.createConnection({
      host: '127.0.0.1',
      port,
      user: 'root',
      password: pass,
      database: 'nenabozeman_db',
    });
  } catch (e) {
    console.error(
      'Could not connect to MySQL at 127.0.0.1:%s — start legacy DB: pnpm run legacy-mysql:up (see data/docker/legacy-mysql/README.md)',
      port
    );
    console.error(e.message);
    process.exit(1);
  }

  const [tc] = await conn.query(
    "SELECT COUNT(*) AS c FROM information_schema.tables WHERE table_schema = 'nenabozeman_db' AND table_name = 'default_pages'"
  );
  if (!Array.isArray(tc) || !tc[0] || Number(tc[0].c) === 0) {
    await conn.end();
    console.error('Database has no `default_pages` table (empty import). From data/docker/legacy-mysql, run:');
    console.error(
      '  source .env && docker compose exec -T -e MYSQL_PWD="$MYSQL_ROOT_PASSWORD" db mysql -u root --binary-mode nenabozeman_db < "../../legacy website/nenabozeman_db.sql"'
    );
    process.exit(1);
  }

  // Legacy “development” type pages (parent objectives), same as old nav.
  const [rows] = await conn.query(
    `SELECT p.id, p.slug, p.title, p.status, p.created_on, p.updated_on, f.body
     FROM default_pages p
     INNER JOIN default_def_page_fields f ON CAST(p.entry_id AS UNSIGNED) = f.id
     WHERE p.id IN (21, 33, 38, 39, 40)
     ORDER BY p.id`
  );
  await conn.end();

  if (!Array.isArray(rows) || rows.length === 0) {
    console.error('No rows returned. Check the DB and page IDs.');
    process.exit(1);
  }

  const outDir = join(root, 'src/content/development');
  mkdirSync(outDir, { recursive: true });

  for (const row of rows) {
    const slug = row.slug;
    const title = String(row.title || 'Untitled').replace(/\r\n/g, '\n');
    const bodyHtml = String(row.body || '');
    const created = row.created_on != null ? new Date(Number(row.created_on) * 1000) : undefined;
    const updated = new Date(Number(row.updated_on) * 1000);
    const bodyMd = turndown.turndown(bodyHtml) || '_No body text was stored for this page._';
    const status = pageStatusToEnum(row.status);
    const file = `src/content/development/${slug}.md`;
    const abs = join(root, file);
    const fm = {
      title,
      status,
      address: 'Northeast Bozeman, MT',
      summary: htmlToSummary(bodyHtml) || 'Migrated from the legacy NENA website development pages.',
      dateUpdated: updated,
      dateCreated: created,
      submittedDate: created,
      tags: ['legacy-cms', slug],
    };
    if (Number.isNaN(fm.dateUpdated.getTime())) throw new Error(`Bad date for ${slug}`);
    const h = toYamlishFrontmatter(fm);
    const doc = `---\n${h}---\n\n${bodyMd}\n`;
    writeFileSync(abs, doc, 'utf8');
    console.log('wrote', file);
  }
}

function toYamlishFrontmatter(fm) {
  const lines = [];
  lines.push(`title: ${yamlQuote(fm.title)}`);
  lines.push(`status: ${fm.status}`);
  lines.push(`address: ${yamlQuote(fm.address)}`);
  if (fm.developer) lines.push(`developer: ${yamlQuote(fm.developer)}`);
  if (fm.submittedDate) lines.push(`submittedDate: ${isoDate(fm.submittedDate)}`);
  if (fm.dateCreated) lines.push(`dateCreated: ${isoDate(fm.dateCreated)}`);
  lines.push(`dateUpdated: ${isoDate(fm.dateUpdated)}`);
  lines.push(`summary: ${yamlQuote(fm.summary)}`);
  if (fm.lat != null) lines.push(`lat: ${fm.lat}`);
  if (fm.lng != null) lines.push(`lng: ${fm.lng}`);
  if (Array.isArray(fm.tags) && fm.tags.length) {
    lines.push('tags:');
    for (const t of fm.tags) lines.push(`  - ${yamlQuote(t, true)}`);
  }
  return lines.map((l) => `${l}\n`).join('');
}

function yamlQuote(s, forTag = false) {
  const t = String(s);
  if (!forTag && !/[:\n"'\x00-\x1f#]/.test(t) && t.trim() === t) {
    if (!t.includes("''") && t.length < 200) {
      if (!/[:#\[\]{}&*!]/.test(t)) return t;
    }
  }
  const esc = t.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `"${esc}"`;
}

function isoDate(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
