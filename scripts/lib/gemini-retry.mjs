/**
 * Shared backoff for Gemini HTTP calls.
 * Delays come from GEMINI_RETRY_* (generateContent) or GEMINI_LIST_RETRY_* (the models list).
 * Tests pass overrides near zero.
 */

const RETRY_STATUSES = new Set([429, 500, 502, 503, 504]);
const LIST_RETRY_STATUSES = new Set([500, 502, 503, 504]);

/**
 * @param {unknown} value
 * @param {number} fallback
 */
function intValue(value, fallback) {
  if (value == null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.floor(parsed);
}

/**
 * @param {number} value
 * @param {number} min
 * @param {number} max
 */
function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/**
 * @param {{ attempts?: number, baseMs?: number, maxMs?: number }} [overrides]
 * @param {'GEMINI_RETRY' | 'GEMINI_LIST_RETRY'} [envPrefix]
 */
export function retrySettings(overrides = {}, envPrefix = 'GEMINI_RETRY') {
  const generate = envPrefix === 'GEMINI_RETRY';
  const attempts = intValue(overrides.attempts ?? process.env[`${envPrefix}_ATTEMPTS`], generate ? 5 : 3);
  const baseMs = intValue(overrides.baseMs ?? process.env[`${envPrefix}_BASE_MS`], generate ? 20000 : 2000);
  const maxMs = intValue(overrides.maxMs ?? process.env[`${envPrefix}_MAX_MS`], generate ? 180000 : 15000);
  return {
    attempts: clamp(attempts, 1, 5),
    baseMs: clamp(baseMs, 0, 180000),
    maxMs: clamp(maxMs, 0, 180000),
  };
}

/**
 * @param {string} id
 */
export function isFlashModel(id) {
  return String(id).toLowerCase().includes('flash');
}

/**
 * @param {string | null | undefined} value
 * @param {number} [now]
 */
export function parseRetryAfterHeader(value, now = Date.now()) {
  if (value == null || String(value).trim() === '') return null;
  const trimmed = String(value).trim();
  if (/^\d+(?:\.\d+)?$/.test(trimmed)) return Math.round(Number(trimmed) * 1000);
  const date = Date.parse(trimmed);
  if (Number.isNaN(date)) return null;
  return Math.max(0, date - now);
}

/**
 * @param {unknown} value
 */
export function retryDelayMs(value) {
  if (typeof value === 'string') {
    const match = value.trim().match(/^(\d+(?:\.\d+)?)s$/);
    return match ? Math.round(Number(match[1]) * 1000) : null;
  }
  if (!value || typeof value !== 'object') return null;
  const record = /** @type {{ seconds?: unknown, nanos?: unknown }} */ (value);
  const seconds = Number(record.seconds ?? 0);
  const nanos = Number(record.nanos ?? 0);
  if (!Number.isFinite(seconds) || !Number.isFinite(nanos)) return null;
  return Math.round(seconds * 1000 + nanos / 1e6);
}

/**
 * @param {string} raw
 */
export function retryInfoFromText(raw) {
  try {
    const parsed = JSON.parse(raw);
    const details = parsed?.error?.details;
    if (!Array.isArray(details)) return null;
    for (const detail of details) {
      const type = String(detail?.['@type'] ?? '');
      if (!type.includes('RetryInfo')) continue;
      const ms = retryDelayMs(detail.retryDelay);
      if (ms != null) return ms;
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Server hint when present, otherwise exponential backoff with jitter.
 * Both are capped at settings.maxMs.
 *
 * @param {number} attempt failed attempt, starting at 1
 * @param {{ baseMs: number, maxMs: number }} settings
 * @param {number | null} hintMs
 * @param {() => number} [random]
 */
export function waitForRetry(attempt, settings, hintMs, random = Math.random) {
  const exponential = Math.min(settings.maxMs, settings.baseMs * 2 ** Math.max(0, attempt - 1));
  const jittered = Math.round(exponential * (0.85 + random() * 0.3));
  const chosen = hintMs == null ? jittered : Math.max(0, Math.round(hintMs));
  return Math.min(settings.maxMs, chosen);
}

/**
 * @param {Response} response
 */
export async function retryHintMs(response) {
  const headerMs = parseRetryAfterHeader(response.headers?.get?.('retry-after'));
  let bodyMs = null;
  try {
    bodyMs = retryInfoFromText(await response.clone().text());
  } catch {
    bodyMs = null;
  }
  const values = [headerMs, bodyMs].filter((value) => value != null);
  if (values.length === 0) return null;
  return Math.max(...values);
}

/**
 * @param {unknown} error
 */
export function isTransientNetwork(error) {
  if (!error || typeof error !== 'object') return false;
  const name = 'name' in error ? String(error.name) : '';
  if (name === 'TimeoutError' || name === 'AbortError' || name === 'TypeError') return true;
  return false;
}

/**
 * @param {{ attempt: number, attempts: number, status: number | string, waitMs: number, model?: string }} info
 */
export function logRetry(info) {
  const status = typeof info.status === 'number' ? `HTTP ${info.status}` : info.status;
  const which = info.model ? ` for ${info.model}` : '';
  const seconds = Math.round(info.waitMs / 1000);
  console.error(
    `gemini: attempt ${info.attempt}/${info.attempts}${which} got ${status}; waiting ${seconds}s before attempt ${info.attempt + 1}`,
  );
}

/**
 * @param {typeof fetch} fetchImpl
 * @param {string | URL} url
 * @param {RequestInit} init
 * @param {{
 *   settings?: { attempts?: number, baseMs?: number, maxMs?: number },
 *   envPrefix?: 'GEMINI_RETRY' | 'GEMINI_LIST_RETRY',
 *   statuses?: Set<number>,
 *   sleep?: (ms: number) => Promise<void>,
 *   random?: () => number,
 *   onRetry?: (info: { attempt: number, attempts: number, status: number | string, waitMs: number, model?: string }) => void,
 *   retries?: { count: number },
 *   model?: string,
 *   timeoutMs?: number,
 * }} [options]
 */
export async function fetchWithRetry(fetchImpl, url, init, options = {}) {
  const settings = retrySettings(options.settings ?? {}, options.envPrefix ?? 'GEMINI_RETRY');
  const statuses = options.statuses ?? RETRY_STATUSES;
  const sleep = options.sleep ?? ((ms) => new Promise((resolve) => {
    setTimeout(resolve, ms);
  }));
  const random = options.random ?? Math.random;
  const onRetry = options.onRetry ?? logRetry;
  const timeoutMs = options.timeoutMs ?? 45000;
  const baseInit = { ...init };
  delete baseInit.signal;
  /** @type {unknown} */
  let lastError;
  for (let attempt = 1; attempt <= settings.attempts; attempt += 1) {
    try {
      const response = await fetchImpl(url, {
        ...baseInit,
        signal: AbortSignal.timeout(timeoutMs),
      });
      const retryable = !response.ok && statuses.has(response.status);
      if (!retryable || attempt === settings.attempts) return response;
      const waitMs = waitForRetry(attempt, settings, await retryHintMs(response), random);
      onRetry({ attempt, attempts: settings.attempts, status: response.status, waitMs, model: options.model });
      if (options.retries) options.retries.count += 1;
      await sleep(waitMs);
    } catch (error) {
      lastError = error;
      if (!isTransientNetwork(error) || attempt === settings.attempts) throw error;
      const status = error && typeof error === 'object' && 'name' in error && error.name === 'TimeoutError'
        ? 'timeout'
        : 'network';
      const waitMs = waitForRetry(attempt, settings, null, random);
      onRetry({ attempt, attempts: settings.attempts, status, waitMs, model: options.model });
      if (options.retries) options.retries.count += 1;
      await sleep(waitMs);
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Gemini request failed');
}

export { LIST_RETRY_STATUSES, RETRY_STATUSES };
