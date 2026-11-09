/**
 * Google Gemini generateContent call.
 *
 * Swap this file to change providers. Callers pass a prompt and read text back.
 * The API key is sent in a header, not the URL.
 *
 * The default model is a current Flash-Lite id. Set GEMINI_MODEL to override it
 * (the workflow maps the optional Actions variable of the same name).
 */

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
export async function completeGeminiSummary(options) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const model = resolveGeminiModel(options.model);
  const response = await fetchImpl(geminiGenerateUrl(model), {
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
  });
  if (!response.ok) {
    const detail = await readModelError(response);
    const suffix = detail ? `: ${detail}` : '';
    throw new Error(`model HTTP ${response.status} (${model})${suffix}`);
  }
  const payload = await response.json();
  const parts = payload?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts)
    ? parts.map((part) => (typeof part?.text === 'string' ? part.text : '')).join('')
    : '';
  if (!text.trim()) throw new Error(`model returned no text (${model})`);
  return text;
}
