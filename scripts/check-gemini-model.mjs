#!/usr/bin/env node
/**
 * Confirm the configured Gemini model is listed and supports generateContent.
 * The API key is sent in a header and is never printed.
 *
 *   GEMINI_API_KEY=... node scripts/check-gemini-model.mjs
 *
 * GEMINI_MODEL, when set, is the repository variable. A blank value uses the
 * default in scripts/lib/gemini-summary.mjs.
 */

import { appendFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { fetchWithRetry, LIST_RETRY_STATUSES } from './lib/gemini-retry.mjs';
import { DEFAULT_GEMINI_MODEL, GEMINI_API_KEY_ENV, resolveGeminiModel } from './lib/gemini-summary.mjs';

export const MODELS_URL = 'https://generativelanguage.googleapis.com/v1beta/models';
export const AI_STUDIO_KEYS_URL = 'https://aistudio.google.com/apikey';
export const MODEL_VARIABLE = 'GEMINI_MODEL';
export const DEFAULT_MODEL_FILE = 'scripts/lib/gemini-summary.mjs';
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/;
const SETTINGS_VARIABLES = 'Settings → Secrets and variables → Actions → Variables';
const SETTINGS_SECRETS = 'Settings → Secrets and variables → Actions → Secrets';

/**
 * @param {string | undefined} envValue
 * @returns {{ id: string, source: 'default' | 'variable' | 'invalid' }}
 */
export function configuredModel(envValue = process.env.GEMINI_MODEL) {
  const raw = envValue == null ? '' : String(envValue);
  if (!raw.trim()) return { id: DEFAULT_GEMINI_MODEL, source: 'default' };
  try {
    return { id: resolveGeminiModel(raw), source: 'variable' };
  } catch {
    return { id: '', source: 'invalid' };
  }
}

/**
 * @param {string} source
 * @param {string} id
 */
export function sourcePhrase(source, id) {
  if (source === 'variable') return `the repository variable \`${MODEL_VARIABLE}\``;
  if (source === 'invalid') return `the repository variable \`${MODEL_VARIABLE}\` (the value is not a model id and was not printed)`;
  return `the code default \`${id}\` in \`${DEFAULT_MODEL_FILE}\``;
}

/**
 * @param {unknown} model
 */
export function listedModelId(model) {
  if (!model || typeof model !== 'object') return '';
  const record = /** @type {{ name?: unknown, baseModelId?: unknown }} */ (model);
  const name = typeof record.name === 'string' ? record.name : '';
  const fromName = name.startsWith('models/') ? name.slice('models/'.length) : name;
  if (SAFE_ID.test(fromName)) return fromName;
  const base = typeof record.baseModelId === 'string' ? record.baseModelId : '';
  return SAFE_ID.test(base) ? base : '';
}

/**
 * @param {unknown} model
 */
export function supportsGenerateContent(model) {
  if (!model || typeof model !== 'object') return false;
  const methods = /** @type {{ supportedGenerationMethods?: unknown }} */ (model).supportedGenerationMethods;
  return Array.isArray(methods) && methods.includes('generateContent');
}

/**
 * Flash-Lite, then other Flash models, then everything else.
 *
 * @param {string} id
 * @returns {'flash-lite' | 'flash' | 'other'}
 */
export function modelGroup(id) {
  const lower = id.toLowerCase();
  if (lower.includes('flash-lite')) return 'flash-lite';
  if (lower.includes('flash')) return 'flash';
  return 'other';
}

/**
 * @param {string[]} ids
 */
export function orderModelIds(ids) {
  const rank = { 'flash-lite': 0, flash: 1, other: 2 };
  return [...new Set(ids)].sort((a, b) => {
    const group = rank[modelGroup(a)] - rank[modelGroup(b)];
    if (group !== 0) return group;
    return b.localeCompare(a);
  });
}

/**
 * @param {string} id
 */
function listItem(id) {
  const group = modelGroup(id);
  if (group === 'flash-lite') return `- **\`${id}\`** (Flash-Lite)`;
  if (group === 'flash') return `- **\`${id}\`** (Flash)`;
  return `- \`${id}\``;
}

/**
 * @param {string} text
 */
function redact(text) {
  return String(text)
    .replace(/AIza[0-9A-Za-z_-]{10,}/g, '[redacted]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180);
}

/**
 * @param {Response} response
 */
async function readApiMessage(response) {
  let raw = '';
  try {
    raw = await response.text();
  } catch {
    return '';
  }
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.error?.message === 'string') return redact(parsed.error.message);
  } catch {
    // Fall through to a short redacted slice.
  }
  return redact(raw);
}

/**
 * @param {string} apiKey
 * @param {typeof fetch} fetchImpl
 */
function failure(code, extra = {}) {
  const error = new Error(code);
  error.code = code;
  Object.assign(error, extra);
  return error;
}

/**
 * @param {unknown} value
 * @returns {number | null}
 */
function numberOrNull(value) {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

/**
 * @param {Record<string, unknown>} model
 * @param {string} id
 */
function describeModel(model, id) {
  const rawName = typeof model.displayName === 'string' ? model.displayName : '';
  return {
    id,
    displayName: redact(rawName.replace(/[<>]/g, '')).slice(0, 120),
    inputTokenLimit: numberOrNull(model.inputTokenLimit),
    outputTokenLimit: numberOrNull(model.outputTokenLimit),
  };
}

async function listModels(apiKey, fetchImpl, retryOptions = {}) {
  /** @type {string[]} */
  const generateContent = [];
  /** @type {string[]} */
  const listed = [];
  /** @type {Map<string, { id: string, displayName: string, inputTokenLimit: number | null, outputTokenLimit: number | null }>} */
  const details = new Map();
  let pageToken = '';
  for (let page = 0; page < 10; page += 1) {
    const url = new URL(MODELS_URL);
    url.searchParams.set('pageSize', '1000');
    if (pageToken) url.searchParams.set('pageToken', pageToken);
    let response;
    try {
      response = await fetchWithRetry(fetchImpl, url, {
        method: 'GET',
        headers: { 'x-goog-api-key': apiKey },
        signal: AbortSignal.timeout(20000),
      }, {
        envPrefix: 'GEMINI_LIST_RETRY',
        settings: retryOptions.listRetry,
        statuses: LIST_RETRY_STATUSES,
        sleep: retryOptions.sleep,
        random: retryOptions.random,
        onRetry: retryOptions.onRetry,
        model: 'models.list',
        timeoutMs: 20000,
      });
    } catch {
      throw failure('network');
    }
    if (!response.ok) {
      const code = response.status === 401 || response.status === 403
        ? 'auth'
        : response.status >= 500
          ? 'server'
          : 'http';
      throw failure(code, { status: response.status, detail: await readApiMessage(response) });
    }
    let payload;
    try {
      payload = await response.json();
    } catch {
      throw failure('bad-response');
    }
    const models = Array.isArray(payload?.models) ? payload.models : [];
    for (const model of models) {
      const id = listedModelId(model);
      if (!id || !model || typeof model !== 'object') continue;
      listed.push(id);
      if (!supportsGenerateContent(model)) continue;
      generateContent.push(id);
      const record = describeModel(/** @type {Record<string, unknown>} */ (model), id);
      const previous = details.get(id);
      if (!previous || (!previous.displayName && record.displayName)) details.set(id, record);
    }
    pageToken = typeof payload?.nextPageToken === 'string' ? payload.nextPageToken : '';
    if (!pageToken) break;
  }
  return {
    available: orderModelIds(generateContent),
    listed: orderModelIds(listed),
    details,
  };
}

/**
 * @param {{ apiKey?: string, modelEnv?: string, fetchImpl?: typeof fetch }} options
 */
export async function checkGeminiModel(options = {}) {
  const apiKey = (options.apiKey ?? process.env[GEMINI_API_KEY_ENV] ?? '').trim();
  const model = configuredModel(options.modelEnv ?? process.env.GEMINI_MODEL);
  if (!apiKey) return { ok: false, code: 'missing-key', model };
  if (model.source === 'invalid') return { ok: false, code: 'invalid-model', model };
  try {
    const { available, listed, details } = await listModels(apiKey, options.fetchImpl ?? fetch, options);
    if (available.includes(model.id)) {
      return { ok: true, code: 'ok', model, available, selected: details.get(model.id) ?? null };
    }
    if (listed.includes(model.id)) return { ok: false, code: 'unsupported', model, available };
    return { ok: false, code: 'missing-model', model, available };
  } catch (error) {
    const code = error && typeof error === 'object' && 'code' in error ? String(error.code) : 'network';
    const status = error && typeof error === 'object' && 'status' in error ? Number(error.status) : 0;
    const detail = error && typeof error === 'object' && 'detail' in error ? String(error.detail ?? '') : '';
    return { ok: false, code, model, status, detail };
  }
}

/**
 * @param {Awaited<ReturnType<typeof checkGeminiModel>>} result
 */
export function renderCheck(result) {
  const model = result.model ?? { id: DEFAULT_GEMINI_MODEL, source: 'default' };
  const where = sourcePhrase(model.source, model.id || DEFAULT_GEMINI_MODEL);
  /** @type {string[]} */
  const lines = ['## Check Gemini model is available', ''];
  if (result.ok) {
    const log = `\`${model.id}\` is available and supports \`generateContent\`. Source: ${where}.`;
    const selected = result.selected ?? null;
    const others = orderModelIds((result.available ?? []).filter((id) => id !== model.id));
    lines.push('**Passed.**', '');
    lines.push(`Configured model: \`${model.id}\`. Source: ${where}.`, '');
    if (selected?.displayName) lines.push(`Display name: ${selected.displayName}`);
    if (selected?.inputTokenLimit != null) lines.push(`Input token limit: ${selected.inputTokenLimit}`);
    if (selected?.outputTokenLimit != null) lines.push(`Output token limit: ${selected.outputTokenLimit}`);
    if (selected?.displayName || selected?.inputTokenLimit != null || selected?.outputTokenLimit != null) {
      lines.push('');
    }
    lines.push('<details>');
    lines.push('<summary>Other models that support generateContent</summary>', '');
    if (others.length === 0) {
      lines.push('No other models that support `generateContent` were listed.');
    } else {
      lines.push(...others.map(listItem));
    }
    lines.push('', '</details>', '');
    lines.push(`To switch models, set repository variable \`${MODEL_VARIABLE}\` under ${SETTINGS_VARIABLES}, or update the default in \`${DEFAULT_MODEL_FILE}\`, then rerun.`);
    lines.push('');
    return { log, annotation: '', summary: `${lines.join('\n')}\n` };
  }

  if (result.code === 'missing-key') {
    lines.push(
      `\`GEMINI_API_KEY\` is not set, so the Gemini model check cannot run.`,
      '',
      `Add a repository secret named \`GEMINI_API_KEY\` under ${SETTINGS_SECRETS}.`,
      `Create the key in Google AI Studio: ${AI_STUDIO_KEYS_URL}`,
      'Then rerun this workflow.',
      '',
    );
  } else if (result.code === 'invalid-model') {
    lines.push(
      `Repository variable \`${MODEL_VARIABLE}\` is set, but the value is not a model id. The value was not printed.`,
      '',
      `Set \`${MODEL_VARIABLE}\` under ${SETTINGS_VARIABLES} to a model id, or clear it to use the code default in \`${DEFAULT_MODEL_FILE}\` (\`${DEFAULT_GEMINI_MODEL}\`).`,
      'Then rerun this workflow.',
      '',
    );
  } else if (result.code === 'auth') {
    const status = result.status || 401;
    const detail = result.detail ? ` ${result.detail}` : '';
    lines.push(
      `Gemini rejected the API key (HTTP ${status}).${detail}`,
      'The key may be wrong, or the Generative Language API may not be enabled for it.',
      '',
      `Open Google AI Studio (${AI_STUDIO_KEYS_URL}), create or check the key, then update the repository secret \`GEMINI_API_KEY\` under ${SETTINGS_SECRETS}.`,
      'Then rerun this workflow.',
      '',
    );
  } else if (result.code === 'network') {
    lines.push(
      'The Gemini models list could not be reached (network error).',
      `This is not a model-id problem. Rerun the workflow. If it keeps failing, confirm GitHub Actions can reach ${MODELS_URL}.`,
      '',
    );
  } else if (result.code === 'server') {
    lines.push(
      `The Gemini models list returned HTTP ${result.status || 500}.`,
      'This is not a model-id problem. Rerun the workflow.',
      '',
    );
  } else if (result.code === 'http' || result.code === 'bad-response') {
    const status = result.code === 'http' ? `HTTP ${result.status}` : 'a response that was not JSON';
    const detail = result.detail ? ` ${result.detail}` : '';
    lines.push(
      `The Gemini models list returned ${status}.${detail}`,
      `The check could not tell which models are available. Rerun the workflow. If it keeps failing, check the key in Google AI Studio: ${AI_STUDIO_KEYS_URL}`,
      '',
    );
  } else {
    const available = Array.isArray(result.available) ? result.available : [];
    const problem = result.code === 'unsupported'
      ? `\`${model.id}\` is listed but does not support \`generateContent\`.`
      : `\`${model.id}\` is not in the models list.`;
    lines.push(`${problem} It comes from ${where}.`, '');
    lines.push('Models that support `generateContent` (Flash-Lite and Flash first):', '');
    if (available.length === 0) {
      lines.push('The models list returned no models that support `generateContent`.', '');
    } else {
      lines.push(...available.map(listItem), '');
    }
    lines.push(
      `Set repository variable \`${MODEL_VARIABLE}\` under ${SETTINGS_VARIABLES} to one of the listed ids, or update the default in \`${DEFAULT_MODEL_FILE}\`, then rerun this workflow.`,
      '',
    );
  }

  const summary = `${lines.join('\n')}\n`;
  const log = lines.slice(2).join('\n').trim();
  const annotation = `::error::${log.replace(/[\r\n]+/g, ' ').replace(/%/g, '%25')}`;
  return { log, annotation, summary };
}

async function main() {
  const result = await checkGeminiModel();
  const rendered = renderCheck(result);
  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, rendered.summary);
  }
  if (result.ok) {
    console.log(rendered.log);
    return;
  }
  console.error(rendered.log);
  console.error(rendered.annotation);
  process.exitCode = 1;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(() => {
    const line = 'Gemini model check failed before it could report a result.';
    if (process.env.GITHUB_STEP_SUMMARY) {
      appendFileSync(
        process.env.GITHUB_STEP_SUMMARY,
        `## Check Gemini model is available\n\n**Stopped.**\n\n${line}\n`,
      );
    }
    console.error(`::error::${line}`);
    process.exitCode = 1;
  });
}
