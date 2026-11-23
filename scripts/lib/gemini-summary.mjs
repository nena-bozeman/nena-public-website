/**
 * Google Gemini generateContent call.
 *
 * Swap this file to change providers. Callers pass a prompt and read text back.
 * The API key is sent in a header, not the URL.
 *
 * The default model is a current Flash-Lite id. Set GEMINI_MODEL to override it
 * (the workflow maps the optional Actions variable of the same name).
 * GEMINI_FALLBACK_MODEL, when set to another Flash or Flash-Lite id that the
 * models list says supports generateContent, is tried after HTTP 503 retries.
 */

import { fetchWithRetry, isFlashModel, retrySettings } from './gemini-retry.mjs';

const MODELS_LIST_URL = 'https://generativelanguage.googleapis.com/v1beta/models?pageSize=1000';
/** @type {Set<string> | null} */
let flashModelIds = null;

export const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';
/** Default model id used when GEMINI_MODEL is unset. */
export const GEMINI_MODEL = DEFAULT_GEMINI_MODEL;
export const GEMINI_API_KEY_ENV = 'GEMINI_API_KEY';
export const GEMINI_MAX_OUTPUT_TOKENS = 512;

const MODEL_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{0,80}$/;

/**
 * @param {string | undefined} explicit
 */
export function resolveGeminiModel(explicit) {
  const raw = explicit != null ? String(explicit) : (process.env.GEMINI_MODEL ?? '');
  const chosen = raw.trim();
  if (!chosen) return DEFAULT_GEMINI_MODEL;
  if (!MODEL_ID.test(chosen)) {
    throw new Error('GEMINI_MODEL must be a model id such as gemini-3.5-flash-lite');
  }
  return chosen;
}

/**
 * Gemini 2.5 accepts thinkingBudget. Newer Flash models use thinkingLevel.
 * MINIMAL keeps thinking tokens from consuming the output cap.
 *
 * @param {string} model
 */
export function thinkingConfigFor(model) {
  if (model.startsWith('gemini-2.5')) return { thinkingBudget: 0 };
  return { thinkingLevel: 'MINIMAL' };
}

/**
 * @param {string} model
 */
export function geminiGenerateUrl(model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
}

/**
 * @param {Response} response
 */
async function readModelError(response) {
  let raw = '';
  try {
    raw = await response.text();
  } catch {
    return '';
  }
  let message = raw;
  try {
    const parsed = JSON.parse(raw);
    if (typeof parsed?.error?.message === 'string') message = parsed.error.message;
  } catch {
    // Keep a short slice of a non-JSON body.
  }
  return message
    .replace(/AIza[0-9A-Za-z_-]{10,}/g, '[redacted]')
    .replace(/Bearer\s+\S+/gi, 'Bearer [redacted]')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 160);
}

/**
 * @param {{
 *   apiKey: string,
 *   systemPrompt: string,
 *   userText: string,
 *   fetchImpl?: typeof fetch,
 *   maxOutputTokens?: number,
 *   model?: string,
 * }} options
 * @returns {Promise<string>}
 */
/**
 * @param {string | undefined} explicit
 */
export function resolveFallbackModel(explicit) {
  const raw = explicit != null ? String(explicit) : (process.env.GEMINI_FALLBACK_MODEL ?? '');
  const chosen = raw.trim();
  if (!chosen || !MODEL_ID.test(chosen) || !isFlashModel(chosen)) return '';
  return chosen;
}

/** Test hook. Production caches the models list for the process. */
export function clearFlashModelCache() {
  flashModelIds = null;
}

/**
 * @param {string} apiKey
 * @param {typeof fetch} fetchImpl
 * @param {Parameters<typeof fetchWithRetry>[3]} retryOptions
 */
async function flashModelsFromList(apiKey, fetchImpl, retryOptions) {
  if (flashModelIds) return flashModelIds;
  const response = await fetchWithRetry(fetchImpl, MODELS_LIST_URL, {
    method: 'GET',
    headers: { 'x-goog-api-key': apiKey },
    signal: AbortSignal.timeout(20000),
  }, {
    ...retryOptions,
    envPrefix: 'GEMINI_LIST_RETRY',
    settings: retryOptions.settings ?? retrySettings({}, 'GEMINI_LIST_RETRY'),
    model: 'models.list',
    timeoutMs: 20000,
  });
  if (!response.ok) return null;
  const payload = await response.json();
  /** @type {Set<string>} */
  const ids = new Set();
  for (const model of payload?.models ?? []) {
    const name = typeof model?.name === 'string' ? model.name.replace(/^models\//, '') : '';
    const methods = model?.supportedGenerationMethods;
    if (!MODEL_ID.test(name) || !isFlashModel(name)) continue;
    if (Array.isArray(methods) && methods.includes('generateContent')) ids.add(name);
  }
  flashModelIds = ids;
  return ids;
}

/**
 * @param {Parameters<typeof completeGeminiSummary>[0]} options
 * @param {string} model
 */
async function generateOnce(options, model) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchWithRetry(fetchImpl, geminiGenerateUrl(model), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-goog-api-key': options.apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: options.systemPrompt }] },
      contents: [{ role: 'user', parts: [{ text: options.userText }] }],
      generationConfig: {
        temperature: 0,
        maxOutputTokens: options.maxOutputTokens ?? GEMINI_MAX_OUTPUT_TOKENS,
        responseMimeType: 'application/json',
        thinkingConfig: thinkingConfigFor(model),
      },
    }),
    signal: AbortSignal.timeout(45000),
  }, {
    settings: options.retry,
    sleep: options.sleep,
    random: options.random,
    onRetry: options.onRetry,
    retries: options.retries,
    model,
    timeoutMs: 45000,
  });
  if (!response.ok) {
    const detail = await readModelError(response);
    const suffix = detail ? `: ${detail}` : '';
    const error = new Error(`model HTTP ${response.status} (${model})${suffix}`);
    error.status = response.status;
    throw error;
  }
  const payload = await response.json();
  const parts = payload?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts)
    ? parts.map((part) => (typeof part?.text === 'string' ? part.text : '')).join('')
    : '';
  if (!text.trim()) throw new Error(`model returned no text (${model})`);
  return text;
}

/**
 * @param {{
 *   apiKey: string,
 *   systemPrompt: string,
 *   userText: string,
 *   fetchImpl?: typeof fetch,
 *   maxOutputTokens?: number,
 *   model?: string,
 *   retry?: { attempts?: number, baseMs?: number, maxMs?: number },
 *   sleep?: (ms: number) => Promise<void>,
 *   random?: () => number,
 *   onRetry?: (info: { attempt: number, attempts: number, status: number | string, waitMs: number, model?: string }) => void,
 *   retries?: { count: number },
 *   fallbackModel?: string,
 *   skipFallback?: boolean,
 * }} options
 * @returns {Promise<string>}
 */
export async function completeGeminiSummary(options) {
  const primary = resolveGeminiModel(options.model);
  try {
    return await generateOnce(options, primary);
  } catch (error) {
    if (options.skipFallback || error?.status !== 503) throw error;
    const fallback = resolveFallbackModel(options.fallbackModel);
    if (!fallback || fallback === primary) throw error;
    let listed = null;
    try {
      listed = await flashModelsFromList(options.apiKey, options.fetchImpl ?? fetch, {
        settings: retrySettings({}, 'GEMINI_LIST_RETRY'),
        sleep: options.sleep,
        random: options.random,
        onRetry: options.onRetry,
      });
    } catch {
      console.error('gemini: could not verify the fallback model; not using it.');
      throw error;
    }
    if (!listed || !listed.has(fallback)) {
      console.error(`gemini: fallback ${fallback} is not a listed Flash model with generateContent; not using it.`);
      throw error;
    }
    console.error(`gemini: ${primary} still returning HTTP 503; trying ${fallback}`);
    return generateOnce({ ...options, skipFallback: true }, fallback);
  }
}
