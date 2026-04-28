// Tests for the public `fetchStream(resource, options)` entry point.
//
// Verifies the signature mirrors WHATWG fetch():
//   - string | URL | Request as the first arg
//   - RequestInit (method, headers, body, signal, ...) as the second arg
//   - signal-based abort propagates through to the handle's done promise
import test from 'node:test';
import assert from 'node:assert/strict';
import { fetchStream } from '../src/index.js';

const enc = new TextEncoder();

// Tiny helper: make a fake `fetch` that returns a streamed body of `chunks`
// after observing how it was called. Honors AbortSignal cleanly so the test
// runner never sees stray asynchronous activity after a test resolves.
function installFakeFetch(chunks, { delayMs = 0, status = 200 } = {}) {
  const observed = { calls: 0, lastResource: null, lastOptions: null };
  const prev = globalThis.fetch;

  globalThis.fetch = async (resource, options) => {
    observed.calls++;
    observed.lastResource = resource;
    observed.lastOptions = options;

    const signal = options && options.signal;
    if (signal && signal.aborted) {
      throw new DOMException('Aborted', 'AbortError');
    }

    let cancelled = false;
    const body = new ReadableStream({
      async start(controller) {
        const onAbort = () => {
          if (cancelled) return;
          cancelled = true;
          try { controller.error(new DOMException('Aborted', 'AbortError')); }
          catch { /* already errored / closed */ }
        };
        if (signal) signal.addEventListener('abort', onAbort);
        try {
          for (const c of chunks) {
            if (cancelled) return;
            if (delayMs) {
              await new Promise((resolve) => {
                const id = setTimeout(resolve, delayMs);
                if (signal) signal.addEventListener('abort', () => {
                  clearTimeout(id);
                  resolve();
                }, { once: true });
              });
            }
            if (cancelled) return;
            controller.enqueue(typeof c === 'string' ? enc.encode(c) : c);
          }
          if (!cancelled) controller.close();
        } finally {
          if (signal) signal.removeEventListener('abort', onAbort);
        }
      },
      cancel() { cancelled = true; },
    });
    return new Response(body, { status });
  };

  return {
    observed,
    restore() { globalThis.fetch = prev; },
  };
}

test('fetchStream(resource): accepts a string URL like fetch()', async () => {
  const fake = installFakeFetch(['{"ok":true}']);
  try {
    let result;
    await fetchStream('https://example.test/data.json').on('$', (v) => { result = v; });
    assert.deepStrictEqual(result, { ok: true });
    assert.equal(fake.observed.lastResource, 'https://example.test/data.json');
    assert.equal(fake.observed.lastOptions, undefined);
  } finally { fake.restore(); }
});

test('fetchStream(resource, options): forwards RequestInit verbatim', async () => {
  const fake = installFakeFetch(['[1,2,3]']);
  try {
    const opts = {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-trace': 'abc' },
      body: JSON.stringify({ q: 'hi' }),
      credentials: 'include',
      cache: 'no-store',
    };
    const items = [];
    await fetchStream('https://example.test/q', opts).on('$.*', (v) => items.push(v));
    assert.deepStrictEqual(items, [1, 2, 3]);
    assert.strictEqual(fake.observed.lastOptions, opts);
    assert.equal(fake.observed.lastOptions.method, 'POST');
    assert.equal(fake.observed.lastOptions.headers['x-trace'], 'abc');
  } finally { fake.restore(); }
});

test('fetchStream(Request): accepts a Request instance as resource', async () => {
  if (typeof Request !== 'function') return; // older Node fallback
  const fake = installFakeFetch(['{"hello":"world"}']);
  try {
    const req = new Request('https://example.test/echo', { method: 'GET' });
    let snap;
    await fetchStream(req).on('$', (v) => { snap = v; });
    assert.deepStrictEqual(snap, { hello: 'world' });
    assert.strictEqual(fake.observed.lastResource, req);
  } finally { fake.restore(); }
});

test('fetchStream({ signal }): aborting rejects the handle', async () => {
  const fake = installFakeFetch(['{"a":', '1}'], { delayMs: 30 });
  try {
    const ac = new AbortController();
    const handle = fetchStream('https://example.test/slow', { signal: ac.signal });
    setTimeout(() => ac.abort(), 5);
    let caught;
    try { await handle; } catch (e) { caught = e; }
    assert.ok(caught, 'handle should reject when signal aborts');
    assert.ok(
      caught.name === 'AbortError' || /abort/i.test(String(caught)),
      'rejection should reflect an abort: ' + caught
    );
  } finally { fake.restore(); }
});

test('fetchStream: non-2xx responses reject with status info', async () => {
  const fake = installFakeFetch([], { status: 404 });
  try {
    let caught;
    try {
      await fetchStream('https://example.test/missing');
    } catch (e) { caught = e; }
    assert.ok(caught, 'expected fetchStream to reject for HTTP 404');
    assert.equal(caught.status, 404);
    assert.match(String(caught), /404/);
  } finally { fake.restore(); }
});

test('fetchStream: non-2xx cancels the response body so it does not dangle', async () => {
  let cancelCalled = false;
  const prev = globalThis.fetch;
  globalThis.fetch = async () => {
    const body = new ReadableStream({
      start(controller) {
        // fill with a chunk; we want to verify the consumer cancels it
        controller.enqueue(enc.encode('"unused"'));
      },
      cancel() { cancelCalled = true; },
    });
    return new Response(body, { status: 500 });
  };
  try {
    let caught;
    try { await fetchStream('https://example.test/oops'); }
    catch (e) { caught = e; }
    assert.ok(caught && caught.status === 500);
    assert.equal(cancelCalled, true, 'body.cancel() should have been called on non-2xx');
  } finally { globalThis.fetch = prev; }
});
