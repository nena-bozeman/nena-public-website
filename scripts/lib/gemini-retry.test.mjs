import assert from 'node:assert/strict';
import test from 'node:test';
import { completeGeminiSummary, clearFlashModelCache, DEFAULT_GEMINI_MODEL } from './gemini-summary.mjs';
import {
  parseRetryAfterHeader,
  retryInfoFromText,
  retrySettings,
  waitForRetry,
} from './gemini-retry.mjs';

const ZERO = { attempts: 3, baseMs: 0, maxMs: 0 };
const KEY = 'AIzaSySECRETSECRETSECRET';

function jsonResponse(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers });
}

function textParts(text) {
  return jsonResponse({ candidates: [{ content: { parts: [{ text }] } }] });
}

test('backoff uses Retry-After and RetryInfo, and caps the wait', () => {
  const settings = retrySettings({ attempts: 5, baseMs: 20000, maxMs: 180000 });
  assert.equal(settings.attempts, 5);
  assert.equal(settings.baseMs, 20000);
  const hinted = waitForRetry(1, settings, 15000, () => 0);
  assert.equal(hinted, 15000);
  const capped = waitForRetry(1, settings, 600000, () => 0);
  assert.equal(capped, 180000);
  const jittered = waitForRetry(1, settings, null, () => 0);
  assert.equal(jittered, Math.round(20000 * 0.85));
  const later = waitForRetry(3, settings, null, () => 0);
  assert.equal(later, Math.round(80000 * 0.85));
  assert.equal(parseRetryAfterHeader('15'), 15000);
  assert.equal(retryInfoFromText(JSON.stringify({
    error: { details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '30s' }] },
  })), 30000);
});

test('429 waits for Retry-After and 404 is not retried', async () => {
  const waits = [];
  let calls = 0;
  const notes = [];
  const fetchImpl = async () => {
    calls += 1;
    if (calls < 3) {
      return new Response(JSON.stringify({
        error: { message: `busy ${KEY}`, details: [{ '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '12s' }] },
      }), {
        status: 429,
        headers: { 'retry-after': '9' },
      });
    }
    return textParts('ok');
  };
  const retries = { count: 0 };
  const text = await completeGeminiSummary({
    apiKey: KEY,
    systemPrompt: 'system',
    userText: 'user',
    fetchImpl,
    retry: { attempts: 4, baseMs: 20000, maxMs: 180000 },
    sleep: async (ms) => { waits.push(ms); },
    random: () => 0,
    onRetry: (info) => notes.push(info),
    retries,
    fallbackModel: '',
  });
  assert.equal(text, 'ok');
  assert.equal(calls, 3);
  assert.deepEqual(waits, [12000, 12000]);
  assert.equal(retries.count, 2);
  assert.equal(notes[0].status, 429);
  assert.equal(notes[0].attempt, 1);
  assert.match(notes[0].model, /gemini-/);

  let denied = 0;
  await assert.rejects(
    () => completeGeminiSummary({
      apiKey: KEY,
      systemPrompt: 'system',
      userText: 'user',
      fetchImpl: async () => {
        denied += 1;
        return new Response('no', { status: 404 });
      },
      retry: ZERO,
      fallbackModel: '',
    }),
    /model HTTP 404/,
  );
  assert.equal(denied, 1);
});

test('400, 401, and 403 are not retried', async () => {
  for (const status of [400, 401, 403]) {
    let calls = 0;
    await assert.rejects(
      () => completeGeminiSummary({
        apiKey: KEY,
        systemPrompt: 'system',
        userText: 'user',
        fetchImpl: async () => {
          calls += 1;
          return new Response('no', { status });
        },
        retry: ZERO,
        fallbackModel: '',
      }),
      new RegExp(`model HTTP ${status}`),
    );
    assert.equal(calls, 1);
  }
});

test('a timeout is retried and the key is not logged', async () => {
  const notes = [];
  let calls = 0;
  const fetchImpl = async () => {
    calls += 1;
    if (calls === 1) {
      const error = new Error(`timed out ${KEY}`);
      error.name = 'TimeoutError';
      throw error;
    }
    return textParts('ok');
  };
  const text = await completeGeminiSummary({
    apiKey: KEY,
    systemPrompt: 'system',
    userText: 'user',
    fetchImpl,
    retry: ZERO,
    sleep: async () => {},
    onRetry: (info) => notes.push(info),
    fallbackModel: '',
  });
  assert.equal(text, 'ok');
  assert.equal(notes[0].status, 'timeout');
  assert.equal(JSON.stringify(notes).includes(KEY), false);
});

test('HTTP 503 tries a listed Flash fallback and ignores a non-Flash id', async () => {
  clearFlashModelCache();
  /** @type {string[]} */
  const urls = [];
  const fetchImpl = async (url) => {
    const href = String(url);
    urls.push(href);
    assert.equal(href.includes(KEY), false);
    if (href.includes('/models?')) {
      return jsonResponse({
        models: [
          { name: 'models/gemini-2.5-pro', supportedGenerationMethods: ['generateContent'] },
          { name: 'models/gemini-3.1-flash-lite', supportedGenerationMethods: ['generateContent'] },
        ],
      });
    }
    if (href.includes(DEFAULT_GEMINI_MODEL)) return new Response('busy', { status: 503 });
    if (href.includes('gemini-3.1-flash-lite')) return textParts('from-fallback');
    return new Response('no', { status: 404 });
  };
  const text = await completeGeminiSummary({
    apiKey: KEY,
    systemPrompt: 'system',
    userText: 'user',
    fetchImpl,
    retry: { attempts: 2, baseMs: 0, maxMs: 0 },
    sleep: async () => {},
    fallbackModel: 'gemini-3.1-flash-lite',
  });
  assert.equal(text, 'from-fallback');
  assert.equal(urls.filter((url) => url.includes(DEFAULT_GEMINI_MODEL)).length, 2);
  assert.ok(urls.some((url) => url.includes('gemini-3.1-flash-lite')));

  clearFlashModelCache();
  let proCalls = 0;
  await assert.rejects(
    () => completeGeminiSummary({
      apiKey: KEY,
      systemPrompt: 'system',
      userText: 'user',
      fetchImpl: async () => {
        proCalls += 1;
        return new Response('busy', { status: 503 });
      },
      retry: { attempts: 1, baseMs: 0, maxMs: 0 },
      fallbackModel: 'gemini-2.5-pro',
    }),
    /model HTTP 503/,
  );
  assert.equal(proCalls, 1);
});
