import { createHash } from 'node:crypto';
import { applySiteBaseToPathname, normalizeAstroBase } from '../../src/utils/site-base.mjs';

export const NENA_SOURCE = 'website';
export const NENA_EXTENDED = {
  source: 'nenaSource',
  slug: 'nenaSlug',
  contentHash: 'nenaContentHash',
};
export const EVENT_TIME_ZONE = 'America/Denver';
export const CANCELLED_PREFIX = '[CANCELLED] ';
export const CALENDAR_SYNC_ALLOW_ENV = 'NENA_CALENDAR_SYNC_ALLOW';

/**
 * Live calendar writes are gated so preview deploys, CI, and accidental local runs
 * cannot mutate the community calendar. Production deploy sets NENA_CALENDAR_SYNC_ALLOW=1.
 *
 * @param {{ dryRun: boolean }} options
 */
export function assertCalendarSyncAllowed(options) {
  if (options.dryRun) return;
  if (process.env[CALENDAR_SYNC_ALLOW_ENV] === '1') return;

  throw new Error(
    'Refusing to write to Google Calendar: live sync runs only on production deploy '
    + `(set ${CALENDAR_SYNC_ALLOW_ENV}=1). Use --dry-run to preview changes locally.`,
  );
}

const REQUIRED_FIELDS = ['title', 'startDate', 'location', 'summary'];

/**
 * @param {string} title
 * @param {boolean | undefined} cancelled
 */
export function formatEventSummary(title, cancelled) {
  const base = String(title ?? '').trim();
  if (!cancelled) {
    return base.replace(new RegExp(`^${escapeRegExp(CANCELLED_PREFIX)}`), '');
  }
  if (base.startsWith(CANCELLED_PREFIX)) return base;
  return `${CANCELLED_PREFIX}${base}`;
}

/**
 * js-yaml parses unquoted YAML timestamps as UTC Date objects whose UTC
 * components match the wall-clock digits in the file. Use those digits as
 * Bozeman local time — do not convert through America/Denver.
 *
 * @param {Date} date
 * @returns {string}
 */
function formatWallClockFromYamlDate(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`;
}

/**
 * @param {unknown} value
 * @returns {{ dateTime: string, timeZone: string }}
 */
export function normalizeDateTime(value) {
  if (value == null || value === '') {
    throw new Error('Event datetime is required');
  }

  if (value instanceof Date) {
    if (Number.isNaN(value.valueOf())) {
      throw new Error('Event datetime is invalid');
    }
    return {
      dateTime: formatWallClockFromYamlDate(value),
      timeZone: EVENT_TIME_ZONE,
    };
  }

  const raw = String(value).trim();
  if (!raw) throw new Error('Event datetime is required');

  const wallClockMatch = raw.match(
    /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})(?:\.\d+)?(?:Z)?$/i,
  );
  if (!wallClockMatch) {
    throw new Error(`Unsupported datetime format: ${raw}`);
  }

  return { dateTime: wallClockMatch[1], timeZone: EVENT_TIME_ZONE };
}

/**
 * @param {{ dateTime: string, timeZone: string }} normalized
 * @param {number} hours
 */
export function addHoursToDateTime(normalized, hours) {
  const match = normalized.dateTime.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/,
  );
  if (!match) return normalized;

  const pad = (n) => String(n).padStart(2, '0');
  let year = Number(match[1]);
  let month = Number(match[2]);
  let day = Number(match[3]);
  let hour = Number(match[4]) + hours;
  const minute = match[5];
  const second = match[6];

  while (hour >= 24) {
    hour -= 24;
    day += 1;
    const daysInMonth = new Date(year, month, 0).getDate();
    if (day > daysInMonth) {
      day = 1;
      month += 1;
      if (month > 12) {
        month = 1;
        year += 1;
      }
    }
  }

  return {
    dateTime: `${year}-${pad(month)}-${pad(day)}T${pad(hour)}:${minute}:${second}`,
    timeZone: EVENT_TIME_ZONE,
  };
}

/**
 * @param {unknown} start
 * @param {unknown} end
 */
export function resolveEventEnd(start, end) {
  if (end != null && end !== '') {
    return normalizeDateTime(end);
  }

  return addHoursToDateTime(normalizeDateTime(start), 1);
}

/**
 * @param {string | undefined} location
 * @param {string | undefined} address
 */
export function formatEventLocation(location, address) {
  const loc = String(location ?? '').trim();
  const addr = String(address ?? '').trim();
  if (loc && addr && loc !== addr) return `${loc} — ${addr}`;
  return loc || addr || '';
}

/**
 * @param {string} text
 */
function escapeHtml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * @param {string} text
 */
function escapeHtmlAttr(text) {
  return escapeHtml(text).replace(/'/g, '&#39;');
}

/**
 * @param {string} href
 * @param {string} siteUrl
 */
function expandMarkdownHref(href, siteUrl) {
  const trimmed = href.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  if (trimmed.startsWith('/')) {
    const origin = siteUrl.replace(/\/$/, '');
    const pathname = applySiteBaseToPathname(trimmed, normalizeAstroBase('/'));
    return `${origin}${pathname}`;
  }
  return trimmed;
}

/**
 * @param {string} text
 * @param {string} siteUrl
 */
export function formatInlineMarkdown(text, siteUrl) {
  const pattern = /(\[[^\]]+\]\([^)]+\)|\*\*[^*]+\*\*)/g;

  return text.split(pattern).map((part) => {
    const linkMatch = part.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
    if (linkMatch) {
      const url = expandMarkdownHref(linkMatch[2], siteUrl);
      return `<a href="${escapeHtmlAttr(url)}">${escapeHtml(linkMatch[1])}</a>`;
    }

    const boldMatch = part.match(/^\*\*([^*]+)\*\*$/);
    if (boldMatch) {
      return `<b>${escapeHtml(boldMatch[1])}</b>`;
    }

    return escapeHtml(part);
  }).join('');
}

/**
 * @param {string} markdown
 * @param {string} siteUrl
 */
export function markdownBodyToCalendarHtml(markdown, siteUrl) {
  const trimmed = String(markdown ?? '').trim();
  if (!trimmed) return '';

  return trimmed
    .split(/\n\s*\n/)
    .map((paragraph) => paragraph
      .split('\n')
      .map((line) => formatInlineMarkdown(line, siteUrl))
      .join('<br>'))
    .join('<br><br>');
}

/**
 * @param {string} summary
 * @param {string} body
 * @param {string} eventPageUrl
 * @param {string | undefined} externalUrl
 * @param {string} siteUrl
 */
export function buildEventDescription(summary, body, eventPageUrl, externalUrl, siteUrl) {
  const bodyText = String(body ?? '').trim();
  const summaryText = String(summary ?? '').trim();
  const mainMarkdown = bodyText || summaryText;

  /** @type {string[]} */
  const parts = [];

  if (mainMarkdown) {
    parts.push(markdownBodyToCalendarHtml(mainMarkdown, siteUrl));
  }

  parts.push(
    `<a href="${escapeHtmlAttr(eventPageUrl)}">View event on NENA website</a>`,
  );

  const ticketUrl = String(externalUrl ?? '').trim();
  if (ticketUrl && !mainMarkdown.includes(ticketUrl)) {
    parts.push(
      `<a href="${escapeHtmlAttr(ticketUrl)}">Register / RSVP</a>`,
    );
  }

  return parts.join('<br><br>');
}

/**
 * @typedef {Object} LocalEvent
 * @property {string} slug
 * @property {string} title
 * @property {unknown} startDate
 * @property {unknown} [endDate]
 * @property {string} location
 * @property {string} [address]
 * @property {string} summary
 * @property {boolean} [cancelled]
 * @property {string} [externalUrl]
 * @property {string} body
 */

/**
 * @param {LocalEvent} event
 * @param {string} siteUrl
 */
export function computeContentHash(event, siteUrl) {
  const eventPageUrl = `${siteUrl.replace(/\/$/, '')}/events/${event.slug}`;
  const payload = {
    title: event.title,
    startDate: serializeDateForHash(event.startDate),
    endDate: serializeDateForHash(event.endDate),
    location: event.location ?? '',
    address: event.address ?? '',
    cancelled: Boolean(event.cancelled),
    calendarDescription: buildEventDescription(
      event.summary,
      event.body,
      eventPageUrl,
      event.externalUrl,
      siteUrl,
    ),
  };

  return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
}

/**
 * @param {LocalEvent} event
 * @param {string} siteUrl
 */
export function buildGoogleCalendarEvent(event, siteUrl) {
  validateLocalEvent(event);

  const eventPageUrl = `${siteUrl.replace(/\/$/, '')}/events/${event.slug}`;
  const hash = computeContentHash(event, siteUrl);
  const start = normalizeDateTime(event.startDate);
  const end = resolveEventEnd(event.startDate, event.endDate);

  return {
    summary: formatEventSummary(event.title, event.cancelled),
    location: formatEventLocation(event.location, event.address),
    description: buildEventDescription(
      event.summary,
      event.body,
      eventPageUrl,
      event.externalUrl,
      siteUrl,
    ),
    start,
    end,
    source: {
      url: eventPageUrl,
      title: event.title,
    },
    extendedProperties: {
      private: {
        [NENA_EXTENDED.source]: NENA_SOURCE,
        [NENA_EXTENDED.slug]: event.slug,
        [NENA_EXTENDED.contentHash]: hash,
      },
    },
  };
}

/**
 * @param {LocalEvent} event
 */
export function validateLocalEvent(event) {
  for (const field of REQUIRED_FIELDS) {
    const value = event[field];
    if (value == null || String(value).trim() === '') {
      throw new Error(`Event "${event.slug}" is missing required field: ${field}`);
    }
  }
}

/**
 * @param {import('googleapis').calendar_v3.Schema$Event} remoteEvent
 */
export function getRemoteSlug(remoteEvent) {
  return remoteEvent.extendedProperties?.private?.[NENA_EXTENDED.slug] ?? null;
}

/**
 * @param {import('googleapis').calendar_v3.Schema$Event} remoteEvent
 */
export function getRemoteContentHash(remoteEvent) {
  return remoteEvent.extendedProperties?.private?.[NENA_EXTENDED.contentHash] ?? null;
}

/**
 * @param {Map<string, LocalEvent>} localBySlug
 * @param {import('googleapis').calendar_v3.Schema$Event[]} remoteEvents
 * @param {string} siteUrl
 */
export function planSyncActions(localBySlug, remoteEvents, siteUrl) {
  /** @type {{ type: 'create', slug: string, event: LocalEvent }[]} */
  const create = [];
  /** @type {{ type: 'update', slug: string, event: LocalEvent, remoteId: string }[]} */
  const update = [];
  /** @type {{ type: 'delete', slug: string, remoteId: string }[]} */
  const deleteActions = [];
  /** @type {{ type: 'skip', slug: string }[]} */
  const skip = [];

  const remoteBySlug = new Map();
  for (const remote of remoteEvents) {
    const slug = getRemoteSlug(remote);
    if (!slug || !remote.id) continue;
    remoteBySlug.set(slug, remote);
  }

  for (const [slug, event] of localBySlug) {
    const remote = remoteBySlug.get(slug);
    const hash = computeContentHash(event, siteUrl);

    if (!remote) {
      create.push({ type: 'create', slug, event });
      continue;
    }

    const remoteHash = getRemoteContentHash(remote);
    if (remoteHash === hash) {
      skip.push({ type: 'skip', slug });
    } else {
      update.push({ type: 'update', slug, event, remoteId: remote.id });
    }
  }

  for (const [slug, remote] of remoteBySlug) {
    if (!localBySlug.has(slug) && remote.id) {
      deleteActions.push({ type: 'delete', slug, remoteId: remote.id });
    }
  }

  return { create, update, delete: deleteActions, skip };
}

/** @param {unknown} value */
function serializeDateForHash(value) {
  if (value == null || value === '') return '';
  if (value instanceof Date) return value.toISOString();
  return String(value).trim();
}

/** @param {string} value */
function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
