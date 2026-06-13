#!/usr/bin/env node
/**
 * Sync src/content/events markdown to Google Calendar on production deploy.
 *
 * Usage:
 *   node scripts/sync-events-to-google-calendar.mjs [--dry-run] [--verbose]
 *
 * Env:
 *   PUBLIC_GOOGLE_CALENDAR_ID
 *   GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON
 *   ASTRO_SITE (default: https://nena-public-website.nenabozeman.workers.dev)
 *   NENA_CALENDAR_SYNC_ALLOW=1 — required for live writes (production deploy only; not needed with --dry-run)
 *
 * Local: `.env` and `.env.local` in the repo root are loaded automatically (shell env wins).
 */

import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import yaml from 'js-yaml';
import { google } from 'googleapis';
import {
  NENA_EXTENDED,
  NENA_SOURCE,
  assertCalendarSyncAllowed,
  buildGoogleCalendarEvent,
  planSyncActions,
  validateLocalEvent,
} from './lib/google-calendar-sync.mjs';
import { loadEnvFiles } from './lib/load-env-files.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
loadEnvFiles(ROOT);
const EVENTS_DIR = join(ROOT, 'src/content/events');

/** @param {string[]} argv */
function parseArgs(argv) {
  return {
    dryRun: argv.includes('--dry-run'),
    verbose: argv.includes('--verbose'),
  };
}

/** @returns {Map<string, import('./lib/google-calendar-sync.mjs').LocalEvent>} */
function loadLocalEvents() {
  if (!existsSync(EVENTS_DIR)) {
    throw new Error(`Events directory not found: ${EVENTS_DIR}`);
  }

  /** @type {Map<string, import('./lib/google-calendar-sync.mjs').LocalEvent>} */
  const bySlug = new Map();

  for (const filename of readdirSync(EVENTS_DIR).filter((f) => f.endsWith('.md'))) {
    const slug = filename.replace(/\.md$/, '');
    const filePath = join(EVENTS_DIR, filename);
    const raw = readFileSync(filePath, 'utf8');
    const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!match) {
      throw new Error(`Missing frontmatter in ${filePath}`);
    }

    const data = yaml.load(match[1]);
    if (!data || typeof data !== 'object') {
      throw new Error(`Invalid frontmatter in ${filePath}`);
    }

    /** @type {import('./lib/google-calendar-sync.mjs').LocalEvent} */
    const event = {
      slug,
      title: String(data.title ?? ''),
      startDate: data.startDate,
      endDate: data.endDate,
      location: String(data.location ?? ''),
      address: data.address ? String(data.address) : undefined,
      summary: String(data.summary ?? ''),
      cancelled: Boolean(data.cancelled),
      externalUrl: data.externalUrl ? String(data.externalUrl) : undefined,
      body: match[2]?.trim() ?? '',
    };

    validateLocalEvent(event);
    bySlug.set(slug, event);
  }

  return bySlug;
}

/** @param {import('googleapis').calendar_v3.Calendar} calendar @param {string} calendarId */
async function listRemoteEvents(calendar, calendarId) {
  /** @type {import('googleapis').calendar_v3.Schema$Event[]} */
  const events = [];
  let pageToken;

  do {
    const response = await calendar.events.list({
      calendarId,
      privateExtendedProperty: `${NENA_EXTENDED.source}=${NENA_SOURCE}`,
      singleEvents: true,
      maxResults: 250,
      pageToken,
    });

    if (response.data.items?.length) {
      events.push(...response.data.items);
    }
    pageToken = response.data.nextPageToken ?? undefined;
  } while (pageToken);

  return events;
}

/** @param {import('googleapis').calendar_v3.Calendar} calendar @param {string} calendarId @param {{ create: { slug: string, event: import('./lib/google-calendar-sync.mjs').LocalEvent }[], update: { slug: string, event: import('./lib/google-calendar-sync.mjs').LocalEvent, remoteId: string }[], delete: { slug: string, remoteId: string }[], skip: { slug: string }[] }} actions @param {string} siteUrl @param {{ dryRun: boolean, verbose: boolean }} options */
async function applySyncActions(calendar, calendarId, actions, siteUrl, options) {
  let created = 0;
  let updated = 0;
  let deleted = 0;
  const skipped = actions.skip.length;

  for (const action of actions.create) {
    buildGoogleCalendarEvent(action.event, siteUrl);
    if (options.dryRun) {
      console.log(`[dry-run] create ${action.slug}`);
    } else {
      await calendar.events.insert({
        calendarId,
        requestBody: buildGoogleCalendarEvent(action.event, siteUrl),
      });
      console.log(`created ${action.slug}`);
    }
    created += 1;
  }

  for (const action of actions.update) {
    if (options.dryRun) {
      console.log(`[dry-run] update ${action.slug}`);
    } else {
      await calendar.events.update({
        calendarId,
        eventId: action.remoteId,
        requestBody: buildGoogleCalendarEvent(action.event, siteUrl),
      });
      console.log(`updated ${action.slug}`);
    }
    updated += 1;
  }

  for (const action of actions.delete) {
    if (options.dryRun) {
      console.log(`[dry-run] delete ${action.slug}`);
    } else {
      await calendar.events.delete({
        calendarId,
        eventId: action.remoteId,
      });
      console.log(`deleted ${action.slug}`);
    }
    deleted += 1;
  }

  if (options.verbose) {
    for (const action of actions.skip) {
      console.log(`skip ${action.slug} (unchanged)`);
    }
  }

  return { created, updated, deleted, skipped };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  assertCalendarSyncAllowed(options);

  const calendarId = process.env.PUBLIC_GOOGLE_CALENDAR_ID?.trim();
  const serviceAccountJson = process.env.GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON?.trim();
  const siteUrl =
    process.env.ASTRO_SITE?.trim()
    ?? 'https://nena-public-website.nenabozeman.workers.dev';

  if (!calendarId) {
    throw new Error('PUBLIC_GOOGLE_CALENDAR_ID is required');
  }
  if (!serviceAccountJson) {
    throw new Error('GOOGLE_CALENDAR_SERVICE_ACCOUNT_JSON is required');
  }

  const credentials = JSON.parse(serviceAccountJson);
  const auth = new google.auth.GoogleAuth({
    credentials,
    scopes: ['https://www.googleapis.com/auth/calendar'],
  });
  const calendar = google.calendar({ version: 'v3', auth });

  const localEvents = loadLocalEvents();
  const remoteEvents = await listRemoteEvents(calendar, calendarId);
  const actions = planSyncActions(localEvents, remoteEvents, siteUrl);

  const summary = await applySyncActions(
    calendar,
    calendarId,
    actions,
    siteUrl,
    options,
  );

  const prefix = options.dryRun ? 'Dry run complete' : 'Sync complete';
  console.log(
    `${prefix}: ${summary.created} created, ${summary.updated} updated, ${summary.deleted} deleted, ${summary.skipped} skipped.`,
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
