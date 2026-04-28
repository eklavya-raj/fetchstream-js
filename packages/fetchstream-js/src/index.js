// fetchstream-js/src/index.js
// Universal entry point. Works in browsers (native fetch) and Node 18+.

import { JSONStreamParser } from './parser.js';
import { StreamPicker } from './picker.js';
import { compilePath } from './path.js';

export { JSONStreamParser } from './parser.js';
export { StreamPicker } from './picker.js';
export { compilePath, matches, prefixMatches, pathToString } from './path.js';

// -------------------------------------------------------------------------
// Public: feedStream(asyncIterableOrReadableStream | ReadableStream<Uint8Array>)
// Returns the same stream-builder API as fetchStream.
// -------------------------------------------------------------------------
export function streamJSON() {
  return new StreamHandle();
}

// -------------------------------------------------------------------------
// Public: fetchStream(resource[, options]) -- the headline API.
//
// Mirrors the WHATWG `fetch()` signature exactly:
//   https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch
//
//   resource : string | URL | Request
//   options  : RequestInit  (method, headers, body, mode, credentials,
//                            cache, redirect, referrer, referrerPolicy,
//                            integrity, keepalive, signal, priority, ...)
//
// Returns a thenable + chainable handle (.on / .onProgress / .live /
// .iterate). Subscriptions registered synchronously after the call are
// honored -- the actual fetch is started on the next microtask.
//
// Aborting via `options.signal` propagates through the body reader and
// rejects the handle's `done` promise with the underlying AbortError.
// -------------------------------------------------------------------------
export function fetchStream(resource, options) {
  const handle = new StreamHandle();

  const start = async () => {
    if (typeof fetch !== 'function') {
      throw new Error('fetch() is not available in this environment');
    }
    const res = await fetch(resource, options);
    if (!res.ok) {
      const err = new Error('HTTP ' + res.status + ' ' + res.statusText);
      err.status = res.status;
      err.response = res;
      // Drain/cancel the body so it doesn't dangle on the runtime's I/O layer.
      if (res.body && typeof res.body.cancel === 'function') {
        try { res.body.cancel(err); } catch { /* best effort */ }
      }
      throw err;
    }
    if (!res.body) {
      // some environments give no body stream; fall back to text()
      const txt = await res.text();
      handle.feedText(txt);
      handle.end();
      return;
    }
    const reader = res.body.getReader();
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        handle.feed(value);
      }
      handle.end();
    } catch (e) {
      handle._error(e);
      throw e;
    }
  };

  // defer start so subscriptions chained synchronously are registered first.
  // Use an explicit body so we don't implicitly return _donePromise into this
  // microtask chain (which would create a second uncaught rejection path -- the
  // handle itself is already the rejection surface for consumers).
  Promise.resolve().then(() => { handle._begin(start); });
  return handle;
}

// -------------------------------------------------------------------------
// StreamHandle -- the user-facing object returned by fetchStream / streamJSON
// -------------------------------------------------------------------------
export class StreamHandle {
  constructor() {
    this.picker = new StreamPicker();
    this.parser = new JSONStreamParser(this.picker.handlers());

    this._encoder = null; // lazy TextEncoder for feedText
    this._iters = [];     // active async iterators awaiting values
    this._throttlers = [];// throttled callbacks needing flush()/cancel() on end
    this._errored = false;// once true, feed/feedText/end become no-ops
    this._donePromise = null;
    this._doneResolve = null;
    this._doneReject = null;
    this._begun = false;

    // pre-create the done promise so it's awaitable any time
    this._donePromise = new Promise((resolve, reject) => {
      this._doneResolve = resolve;
      this._doneReject = reject;
    });

    // wire end/error from picker through to iterator finalization
    this.picker.onAny((event, arg) => {
      if (event === 'end') {
        for (const it of this._iters) it._close();
        this._iters.length = 0;
      } else if (event === 'error') {
        for (const it of this._iters) it._error(arg);
        this._iters.length = 0;
      }
    });
  }

  on(path, callback) {
    this.picker.on(path, callback);
    return this;
  }

  // Fires repeatedly as the value at `path` grows. Callback receives the same
  // mutable root each time it is called. Ideal for rendering a progressive
  // JSON mirror in a UI.
  //
  // Options:
  //   throttle: 'raf'   -- coalesce updates and fire at most once per
  //                        animation frame (uses requestAnimationFrame in
  //                        the browser, ~16ms setTimeout fallback in Node).
  //   throttle: <number> -- coalesce updates over that many milliseconds.
  //   throttle: undefined/false -- fire on every parser mutation (default).
  //
  // The very last update is always flushed synchronously when the stream
  // ends, so the consumer is guaranteed to see the final state before
  // `done` resolves.
  onProgress(path, callback, options) {
    const t = makeThrottler(callback, options && options.throttle);
    if (t.tracked) this._throttlers.push(t);
    this.picker.onProgress(path, t.wrapped);
    return this;
  }

  // Sugar for onProgress('$', cb) -- a live mirror of the whole document.
  // Accepts the same options as onProgress (e.g. { throttle: 'raf' }).
  live(callback, options) {
    return this.onProgress('$', callback, options);
  }

  // Current partial/final root (only set if live / onProgress('$') is used).
  get snapshot() {
    return this.picker.snapshot;
  }

  // Returns an async iterator yielding every value at `path` as it streams in.
  iterate(path) {
    const it = new AsyncQueueIterator();
    this.picker.on(path, (v) => it._push(v));
    this._iters.push(it);
    // make sure the stream is started (don't leak _donePromise via implicit return)
    Promise.resolve().then(() => { this._begin(); });
    return it;
  }

  // ---- feed APIs (used by fetchStream + Node adapter) ----

  feed(uint8) {
    if (this._errored) return;
    this.parser.write(uint8);
  }

  feedText(text) {
    if (this._errored) return;
    if (!this._encoder) this._encoder = new TextEncoder();
    this.parser.write(this._encoder.encode(text));
  }

  end() {
    if (this._errored) return;
    this.parser.end();
    // Make sure any throttled live/progress callback gets the final value
    // before consumers wake up on `done`.
    for (const t of this._throttlers) t.flush();
    this._throttlers.length = 0;
    this._doneResolve();
  }

  _error(e) {
    if (this._errored) return;
    this._errored = true;
    for (const t of this._throttlers) t.cancel();
    this._throttlers.length = 0;
    this._doneReject(e);
    for (const it of this._iters) it._error(e);
    this._iters.length = 0;
  }

  // Start a producer function once. Subsequent calls are no-ops.
  _begin(producer) {
    if (this._begun) return this._donePromise;
    this._begun = true;
    if (producer) {
      producer().then(this._doneResolve, (e) => {
        this._doneReject(e);
        for (const it of this._iters) it._error(e);
      });
    }
    return this._donePromise;
  }

  // Promise-like surface so users can `await fetchStream(url).on(...)`
  then(onF, onR) { return this._donePromise.then(onF, onR); }
  catch(onR)     { return this._donePromise.catch(onR); }
  finally(cb)    { return this._donePromise.finally(cb); }
  get done()     { return this._donePromise; }
}

// -------------------------------------------------------------------------
// AsyncQueueIterator -- internal async iterator with backpressure-friendly queue
// -------------------------------------------------------------------------
class AsyncQueueIterator {
  constructor() {
    this._queue = [];
    this._waiters = []; // {resolve, reject}
    this._done = false;
    this._err = null;
  }
  [Symbol.asyncIterator]() { return this; }
  next() {
    if (this._err) return Promise.reject(this._err);
    if (this._queue.length > 0) {
      return Promise.resolve({ value: this._queue.shift(), done: false });
    }
    if (this._done) {
      return Promise.resolve({ value: undefined, done: true });
    }
    return new Promise((resolve, reject) => {
      this._waiters.push({ resolve, reject });
    });
  }
  return() {
    this._done = true;
    while (this._waiters.length > 0) {
      this._waiters.shift().resolve({ value: undefined, done: true });
    }
    return Promise.resolve({ value: undefined, done: true });
  }
  _push(v) {
    if (this._waiters.length > 0) {
      this._waiters.shift().resolve({ value: v, done: false });
    } else {
      this._queue.push(v);
    }
  }
  _close() {
    this._done = true;
    while (this._waiters.length > 0) {
      this._waiters.shift().resolve({ value: undefined, done: true });
    }
  }
  _error(e) {
    this._err = e;
    while (this._waiters.length > 0) {
      this._waiters.shift().reject(e);
    }
  }
}

// -------------------------------------------------------------------------
// makeThrottler -- wraps a callback so multiple calls within the same tick
// are coalesced into one delivery with the latest arguments. Returns the
// wrapped callback plus flush()/cancel() hooks the StreamHandle uses to
// finalize on stream end / error.
//
// `kind`:
//   'raf'    -> requestAnimationFrame (or setTimeout(~16ms) when rAF is
//               unavailable, e.g. in Node / SSR).
//   <number> -> setTimeout(N ms) coalescing.
//   anything else (incl. undefined) -> no-op passthrough.
// -------------------------------------------------------------------------
function makeThrottler(callback, kind) {
  if (typeof callback !== 'function') {
    throw new TypeError('callback must be a function');
  }
  const scheduler = pickScheduler(kind);
  if (!scheduler) {
    return { wrapped: callback, flush: noop, cancel: noop, tracked: false };
  }

  let pendingArgs = null;
  let scheduledId = null;

  function fire() {
    scheduledId = null;
    if (pendingArgs) {
      const args = pendingArgs;
      pendingArgs = null;
      callback.apply(null, args);
    }
  }

  function wrapped(/* ...args */) {
    pendingArgs = arguments;
    if (scheduledId === null) {
      scheduledId = scheduler.start(fire);
    }
  }
  function flush() {
    if (scheduledId !== null) {
      scheduler.stop(scheduledId);
      scheduledId = null;
    }
    if (pendingArgs) {
      const args = pendingArgs;
      pendingArgs = null;
      callback.apply(null, args);
    }
  }
  function cancel() {
    if (scheduledId !== null) {
      scheduler.stop(scheduledId);
      scheduledId = null;
    }
    pendingArgs = null;
  }

  return { wrapped, flush, cancel, tracked: true };
}

function pickScheduler(kind) {
  if (kind === 'raf') {
    if (typeof requestAnimationFrame === 'function') {
      const cancelRaf = typeof cancelAnimationFrame === 'function'
        ? cancelAnimationFrame
        : null;
      return {
        start: (fn) => requestAnimationFrame(fn),
        stop:  (id) => { if (cancelRaf) cancelRaf(id); },
      };
    }
    // Node / SSR fallback: ~60fps cadence.
    return {
      start: (fn) => setTimeout(fn, 16),
      stop:  (id) => clearTimeout(id),
    };
  }
  if (typeof kind === 'number' && kind >= 0 && Number.isFinite(kind)) {
    return {
      start: (fn) => setTimeout(fn, kind),
      stop:  (id) => clearTimeout(id),
    };
  }
  return null;
}

function noop() {}

// -------------------------------------------------------------------------
// Convenience: parse(text) using the streaming parser. Mainly for tests.
// -------------------------------------------------------------------------
export function parse(text) {
  let result;
  const handle = new StreamHandle();
  handle.on('$', (v) => { result = v; });
  handle.feedText(text);
  handle.end();
  return result;
}
