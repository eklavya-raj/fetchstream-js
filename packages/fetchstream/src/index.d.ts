// Type definitions for fetchstream
// Public entry point: `import { fetchStream, streamJSON, parse, ... } from 'fetchstream'`

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
 *                  (`requestAnimationFrame` in browsers, ~16 ms `setTimeout`
 *                  fallback in Node/SSR).
 *  - `<number>`  — coalesce over N milliseconds (`setTimeout(fn, N)`).
 *  - `false`/`undefined` — no throttling; fire on every parser mutation.
 *
 * The final value is always flushed synchronously when the stream ends, so
 * consumers never miss the terminal state.
 */
export type ThrottleOption = 'raf' | number | false | undefined;

export interface ProgressOptions {
  throttle?: ThrottleOption;
}

// ---------------------------------------------------------------------------
// Callback shapes
// ---------------------------------------------------------------------------

export type MatchCallback<T = JSONValue> =
  (value: T, path: PathStack) => void;

export type ProgressCallback<T = JSONValue> =
  (root: T, path: PathStack) => void;

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
   * `path` grows. The callback receives the same mutable reference each
   * time -- it grows in place.
   *
   * `options.throttle` can be `'raf'` or a millisecond number to coalesce
   * updates. The final value is always flushed before `done` resolves.
   */
  onProgress<T = JSONValue>(
    path: string,
    callback: ProgressCallback<T>,
    options?: ProgressOptions
  ): this;

  /**
   * Sugar for `onProgress('$', cb, options)` — a live mirror of the whole
   * document. `root` grows in place each time the callback fires.
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
