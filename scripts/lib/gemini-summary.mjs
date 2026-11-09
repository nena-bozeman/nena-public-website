/**
 * Google Gemini generateContent call.
 *
 * Swap this file to change providers. Callers pass a prompt and read text back.
 * The API key is sent in a header, not the URL.
 */

export const GEMINI_MODEL = 'gemini-2.5-flash-lite';
export const GEMINI_API_KEY_ENV = 'GEMINI_API_KEY';
export const GEMINI_MAX_OUTPUT_TOKENS = 512;

const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/**
 * @param {{
 *   apiKey: string,
 *   systemPrompt: string,
 *   userText: string,
 *   fetchImpl?: typeof fetch,
 *   maxOutputTokens?: number,
 * }} options
 * @returns {Promise<string>}
 */
export async function completeGeminiSummary(options) {
  const fetchImpl = options.fetchImpl ?? fetch;
  const response = await fetchImpl(GEMINI_URL, {
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
        thinkingConfig: { thinkingBudget: 0 },
      },
    }),
    signal: AbortSignal.timeout(45000),
  });
  if (!response.ok) throw new Error(`model HTTP ${response.status}`);
  const payload = await response.json();
  const parts = payload?.candidates?.[0]?.content?.parts;
  const text = Array.isArray(parts)
    ? parts.map((part) => (typeof part?.text === 'string' ? part.text : '')).join('')
    : '';
  if (!text.trim()) throw new Error('model returned no text');
  return text;
}
