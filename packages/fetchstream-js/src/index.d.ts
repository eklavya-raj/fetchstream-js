// Type definitions for fetchstream-js
// Public entry point: `import { fetchStream, streamJSON, parse, ... } from 'fetchstream-js'`

import { JSONStreamParser } from './parser';
import { StreamPicker } from './picker';

// ---------------------------------------------------------------------------
// JSON value & path types
// ---------------------------------------------------------------------------

export type JSONPrimitive = string | number | boolean | null;
export type JSONValue = JSONPrimitive | JSONObject | JSONArray;
export interface JSONObject { [key: string]: JSONValue }
export interface JSONArray extends Array<JSONValue> {}

/**
 * The path-stack passed to subscription callbacks: an array of object keys
 * (strings) and array indices (numbers) that identifies where the matched
 * value lives in the document tree.
 *
 * Example: for `$.users[2].name` the stack is `['users', 2, 'name']`.
 */
export type PathSegment = string | number;
export type PathStack = readonly PathSegment[];

// ---------------------------------------------------------------------------
// Subscription options
// ---------------------------------------------------------------------------

/**
 * Throttle strategy for `live()` / `onProgress()`.
 *
 *  - `'raf'`     — coalesce updates and fire at most once per animation frame
 *                  (`requestAnimationFrame`). **Default in browsers.**
 *  - `<number>`  — coalesce over N milliseconds (`setTimeout(fn, N)`).
 *  - `false`/`null` — no throttling; fire on every parser mutation.
 *                     **Default in Node / SSR** (no rAF available).
 *
 * The final value is always flushed synchronously when the stream ends, so
 * consumers never miss the terminal state.
 */
export type ThrottleOption = 'raf' | number | false | null | undefined;

export interface ProgressOptions {
  throttle?: ThrottleOption;
}

// ---------------------------------------------------------------------------
// Callback shapes
// ---------------------------------------------------------------------------

export type MatchCallback<T = JSONValue> =
  (value: T, path: PathStack) => void;

/**
 * The fresh wrapper passed to `live()` / `onProgress()` callbacks on every
 * delivery. Pass it directly to `setState` in React: the outer wrapper is a
 * new reference each tick (so React re-renders), while `data` inside is the
 * same in-place-mutating tree (so reads stay zero-copy).
 */
export interface LiveSnapshot<T = JSONValue> {
  /** The current value at the subscribed path. Same reference each tick; mutates in place. */
  readonly data: T;
  /** Per-subscription delivery counter. Starts at 1 on the first callback and increments. */
  readonly chunks: number;
  /** `true` only on the final delivery for this subscription (the value at `path` is fully formed). */
  readonly done: boolean;
  /** The path stack at which this subscription matched. */
  readonly path: PathStack;
}

export type ProgressCallback<T = JSONValue> =
  (snapshot: LiveSnapshot<T>) => void;

// ---------------------------------------------------------------------------
// StreamHandle — return value of fetchStream / streamJSON / streamFrom
// ---------------------------------------------------------------------------

export class StreamHandle implements PromiseLike<void> {
  readonly picker: StreamPicker;
  readonly parser: JSONStreamParser;

  /**
   * Subscribe to a path. The callback fires ONCE per match, after the whole
   * subtree at `path` has been parsed.
   */
  on<T = JSONValue>(path: string, callback: MatchCallback<T>): this;

  /**
   * Subscribe to a path. The callback fires REPEATEDLY as the value at
   * `path` grows. Each call receives a fresh `{ data, chunks, done, path }`
   * wrapper -- safe to pass straight to React's `setState` while still
   * benefiting from the underlying mutate-in-place tree.
   *
   * `options.throttle` defaults to `'raf'` in browsers (one delivery per
   * animation frame) and to no throttle in Node / SSR. The final value is
   * always flushed before `done` resolves, with `done: true` set on the
   * wrapper.
   */
  onProgress<T = JSONValue>(
    path: string,
    callback: ProgressCallback<T>,
    options?: ProgressOptions
  ): this;

  /**
   * Sugar for `onProgress('$', cb, options)` — a live mirror of the whole
   * document. The callback receives a fresh `{ data, chunks, done, path }`
   * wrapper each call; `data` is the in-place-mutating root.
   */
  live<T = JSONValue>(
    callback: ProgressCallback<T>,
    options?: ProgressOptions
  ): this;

  /**
   * Returns an async iterator yielding every match for `path` as it streams
   * in. Use with `for await (...)` for backpressure-friendly processing.
   */
  iterate<T = JSONValue>(path: string): AsyncIterableIterator<T>;

  /** Current partial (or final) live root, if `live()` / `onProgress('$')` is in use. */
  readonly snapshot: JSONValue | undefined;

  /** Push more bytes into the parser. */
  feed(uint8: Uint8Array): void;

  /** Encode `text` as UTF-8 and feed it. */
  feedText(text: string): void;

  /** Finalize the stream. Idempotent. */
  end(): void;

  /** The underlying Promise that resolves when the stream completes. */
  readonly done: Promise<void>;

  // PromiseLike<void>
  then<TResult1 = void, TResult2 = never>(
    onfulfilled?: ((value: void) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ): Promise<TResult1 | TResult2>;
  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null
  ): Promise<void | TResult>;
  finally(onfinally?: (() => void) | null): Promise<void>;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Stream JSON from a URL. Mirrors the WHATWG `fetch()` signature exactly.
 *
 *   resource: string | URL | Request
 *   options:  RequestInit (method, headers, body, signal, ...)
 *
 * Returns a {@link StreamHandle} — chain `.on(path, cb)`, `.live(cb)`,
 * `.iterate(path)`, or `await` it. Aborting via `options.signal` propagates
 * through the body reader and rejects the handle.
 *
 * @example
 * await fetchStream('/api/products', { signal: ac.signal })
 *   .on('$.products.*', render)
 *   .on('$.total', n => setTotal(n));
 */
export function fetchStream(
  resource: string | URL | Request,
  options?: RequestInit
): StreamHandle;

/**
 * Create a `StreamHandle` without fetching. Push bytes manually with
 * `.feed(bytes)` / `.feedText(text)` and call `.end()` when done.
 */
export function streamJSON(): StreamHandle;

/**
 * Synchronous one-shot parse using the streaming parser. Equivalent to
 * `JSON.parse` for any complete, valid JSON string. Mainly useful for tests
 * and tiny utilities -- prefer `JSON.parse` for raw speed on whole strings.
 */
export function parse<T = JSONValue>(text: string): T;

// Re-exports of low-level building blocks (exposed for advanced users).
export { JSONStreamParser } from './parser';
export { StreamPicker } from './picker';
