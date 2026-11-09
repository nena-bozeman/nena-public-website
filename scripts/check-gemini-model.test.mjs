import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';
import {
  AI_STUDIO_KEYS_URL,
  DEFAULT_MODEL_FILE,
  MODEL_VARIABLE,
  checkGeminiModel,
  configuredModel,
  modelGroup,
  orderModelIds,
  renderCheck,
} from './check-gemini-model.mjs';
import { DEFAULT_GEMINI_MODEL } from './lib/gemini-summary.mjs';

const KEY = 'AIzaSySECRETSECRETSECRET';

function model(id, methods = ['generateContent']) {
  return {
    name: `models/${id}`,
    supportedGenerationMethods: methods,
  };
}

function listResponse(models, nextPageToken = '') {
  return new Response(JSON.stringify({ models, ...(nextPageToken ? { nextPageToken } : {}) }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

test('a blank GEMINI_MODEL uses the code default', () => {
  assert.deepEqual(configuredModel(''), { id: DEFAULT_GEMINI_MODEL, source: 'default' });
  assert.deepEqual(configuredModel('  '), { id: DEFAULT_GEMINI_MODEL, source: 'default' });
  assert.deepEqual(configuredModel('gemini-2.5-flash'), { id: 'gemini-2.5-flash', source: 'variable' });
  assert.equal(configuredModel('not a model').source, 'invalid');
});

test('Flash-Lite and Flash models sort ahead of other models', () => {
  assert.deepEqual(
    orderModelIds(['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-3.5-flash-lite', 'gemini-2.0-flash-lite']),
    ['gemini-3.5-flash-lite', 'gemini-2.0-flash-lite', 'gemini-2.5-flash', 'gemini-2.5-pro'],
  );
  assert.equal(modelGroup('gemini-3.5-flash-lite'), 'flash-lite');
  assert.equal(modelGroup('gemini-2.5-flash'), 'flash');
  assert.equal(modelGroup('gemini-2.5-pro'), 'other');
});

test('the configured model passes when it supports generateContent', async () => {
  /** @type {string | undefined} */
  let calledUrl;
  /** @type {Record<string, string> | undefined} */
  let headers;
  const fetchImpl = async (url, init) => {
    calledUrl = String(url);
    headers = init.headers;
    return listResponse([
      model('gemini-2.5-pro'),
      model('gemini-3.5-flash-lite'),
      model('text-embedding-004', ['embedContent']),
    ]);
  };
  const result = await checkGeminiModel({ apiKey: KEY, modelEnv: '', fetchImpl });
  const rendered = renderCheck(result);
  assert.equal(result.ok, true);
  assert.equal(result.model.id, DEFAULT_GEMINI_MODEL);
  assert.match(rendered.log, /gemini-3\.5-flash-lite/);
  assert.match(rendered.log, /generateContent/);
  assert.match(rendered.log, /code default/);
  assert.match(rendered.log, new RegExp(DEFAULT_MODEL_FILE.replaceAll('.', '\\.')));
  assert.equal(rendered.annotation, '');
  assert.equal(calledUrl?.includes(KEY), false);
  assert.equal(calledUrl?.includes('key='), false);
  assert.equal(headers?.['x-goog-api-key'], KEY);
  assert.equal(rendered.summary.includes(KEY), false);
});

test('a missing model lists generateContent models with Flash first and tells how to fix it', async () => {
  const fetchImpl = async () => listResponse([
    model('gemini-2.5-pro'),
    model('gemini-2.5-flash'),
    model('gemini-3.1-flash-lite'),
    model('text-embedding-004', ['embedContent']),
  ]);
  const result = await checkGeminiModel({
    apiKey: KEY,
    modelEnv: 'gemini-2.5-flash-lite',
    fetchImpl,
  });
  const rendered = renderCheck(result);
  assert.equal(result.ok, false);
  assert.match(rendered.log, /gemini-2\.5-flash-lite/);
  assert.match(rendered.log, /repository variable `GEMINI_MODEL`/);
  assert.match(rendered.annotation, /^::error::/);
  assert.match(rendered.summary, /\*\*`gemini-3\.1-flash-lite`\*\* \(Flash-Lite\)/);
  assert.match(rendered.summary, /\*\*`gemini-2\.5-flash`\*\* \(Flash\)/);
  const flashLite = rendered.summary.indexOf('gemini-3.1-flash-lite');
  const flash = rendered.summary.indexOf('gemini-2.5-flash`');
  const pro = rendered.summary.indexOf('gemini-2.5-pro');
  assert.ok(flashLite < flash && flash < pro);
  assert.equal(rendered.summary.includes('text-embedding-004'), false);
  assert.match(rendered.summary, new RegExp(`Set repository variable \`${MODEL_VARIABLE}\` under Settings → Secrets and variables → Actions → Variables`));
  assert.match(rendered.summary, new RegExp(DEFAULT_MODEL_FILE.replaceAll('.', '\\.')));
  assert.match(rendered.summary, /then rerun this workflow/);
  assert.equal(rendered.summary.includes(KEY), false);
  assert.equal(rendered.annotation.includes(KEY), false);
});

test('a model that does not support generateContent fails with the callable list', async () => {
  const fetchImpl = async () => listResponse([
    model('gemini-3.5-flash-lite', ['embedContent']),
    model('gemini-2.5-flash'),
  ]);
  const result = await checkGeminiModel({ apiKey: KEY, modelEnv: '', fetchImpl });
  const rendered = renderCheck(result);
  assert.equal(result.ok, false);
  assert.equal(result.code, 'unsupported');
  assert.match(rendered.summary, /does not support `generateContent`/);
  assert.match(rendered.summary, /code default/);
  assert.match(rendered.summary, /gemini-2\.5-flash/);
});

test('a missing API key does not call Gemini', async () => {
  let called = false;
  const fetchImpl = async () => {
    called = true;
    return listResponse([]);
  };
  const result = await checkGeminiModel({ apiKey: '   ', modelEnv: '', fetchImpl });
  const rendered = renderCheck(result);
  assert.equal(called, false);
  assert.equal(result.code, 'missing-key');
  assert.match(rendered.summary, /GEMINI_API_KEY` is not set/);
  assert.match(rendered.summary, /Settings → Secrets and variables → Actions → Secrets/);
  assert.match(rendered.summary, new RegExp(AI_STUDIO_KEYS_URL.replaceAll('.', '\\.')));
  assert.match(rendered.annotation, /^::error::/);
});

test('401 and 403 name the status and AI Studio and do not print the key', async () => {
  for (const status of [401, 403]) {
    const fetchImpl = async () => new Response(JSON.stringify({
      error: { message: `API key not valid. ${KEY}` },
    }), { status });
    const result = await checkGeminiModel({ apiKey: KEY, modelEnv: '', fetchImpl });
    const rendered = renderCheck(result);
    assert.equal(result.code, 'auth');
    assert.match(rendered.summary, new RegExp(`HTTP ${status}`));
    assert.match(rendered.summary, /Generative Language API/);
    assert.match(rendered.summary, new RegExp(AI_STUDIO_KEYS_URL.replaceAll('.', '\\.')));
    assert.match(rendered.summary, /\[redacted\]/);
    assert.equal(rendered.summary.includes(KEY), false);
    assert.equal(rendered.log.includes(KEY), false);
    assert.equal(rendered.annotation.includes(KEY), false);
  }
});

test('a network error and a 5xx error are not described as a bad model id', async () => {
  const network = renderCheck(await checkGeminiModel({
    apiKey: KEY,
    modelEnv: '',
    fetchImpl: async () => {
      throw new Error(`connect failed ${KEY}`);
    },
  }));
  assert.match(network.summary, /network error/);
  assert.match(network.summary, /not a model-id problem/);
  assert.equal(network.summary.includes(KEY), false);

  const server = renderCheck(await checkGeminiModel({
    apiKey: KEY,
    modelEnv: '',
    fetchImpl: async () => new Response('unavailable', { status: 503 }),
  }));
  assert.match(server.summary, /HTTP 503/);
  assert.match(server.summary, /not a model-id problem/);
  assert.match(server.summary, /Rerun the workflow/);
  assert.equal(server.summary.includes('unavailable') || server.summary.includes(KEY), false);
});

test('the models list follows the next page and still sends the key only as a header', async () => {
  /** @type {string[]} */
  const urls = [];
  const fetchImpl = async (url, init) => {
    urls.push(String(url));
    assert.equal(init.headers['x-goog-api-key'], KEY);
    assert.equal(String(url).includes(KEY), false);
    if (!String(url).includes('pageToken=')) {
      return listResponse([model('gemini-2.5-pro')], 'page-2');
    }
    return listResponse([model('gemini-3.5-flash-lite')]);
  };
  const result = await checkGeminiModel({ apiKey: KEY, modelEnv: '', fetchImpl });
  assert.equal(result.ok, true);
  assert.equal(urls.length, 2);
  assert.match(urls[1], /pageToken=page-2/);
});

test('the command fails with an annotation and a step summary and does not print the key', () => {
  const summary = join(mkdtempSync(join(tmpdir(), 'gemini-check-')), 'summary.md');
  const script = fileURLToPath(new URL('./check-gemini-model.mjs', import.meta.url));
  let stderr = '';
  let stdout = '';
  try {
    execFileSync(process.execPath, [script], {
      encoding: 'utf8',
      env: {
        ...process.env,
        GEMINI_API_KEY: '',
        GEMINI_MODEL: '',
        GITHUB_STEP_SUMMARY: summary,
      },
    });
    assert.fail('expected the check to exit');
  } catch (error) {
    stderr = String(error.stderr ?? '');
    stdout = String(error.stdout ?? '');
    assert.equal(error.status, 1);
  }
  const written = readFileSync(summary, 'utf8');
  assert.match(stderr, /::error::/);
  assert.match(written, /GEMINI_API_KEY` is not set/);
  assert.match(written, /Settings → Secrets and variables → Actions → Secrets/);
  assert.equal(stderr.includes(KEY), false);
  assert.equal(stdout.includes(KEY), false);
  assert.equal(written.includes(KEY), false);
});
