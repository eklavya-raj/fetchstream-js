# Changelog

All notable changes to the `fetchstream-js` package will be documented here.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Changed (BREAKING, pre-1.0)

- `live(cb)` / `onProgress(path, cb)` callbacks now receive **a single
  fresh wrapper** instead of `(root, path)`:

  ```js
  // Before
  .live((root, path) => render(root))

  // After
  .live(({ data, chunks, done, path }) => render(data))
  ```

  The wrapper has shape `{ data, chunks, done, path }`:
  - `data` is the in-place-mutating tree (same reference each tick — reads
    stay zero-copy).
  - `chunks` is a per-subscription delivery counter (1, 2, 3, …). Useful
    as a primitive that always changes.
  - `done` is `true` only on the final delivery for that subscription.
  - `path` is the matched path stack.

  The wrapper itself is a fresh object per tick, so it is now safe to pass
  straight to React's `setState` without spreading or version counters:

  ```jsx
  const [snap, setSnap] = useState({ data: null, chunks: 0, done: false });
  fetchStream(url).live(setSnap);
  ```

  Allocation cost is one tiny 4-key object per delivery — negligible next
  to parser throughput. The mutate-in-place tree is unchanged.

- **Default throttle is now `'raf'` in browsers** (previously: no throttle).
  In Node / SSR, where `requestAnimationFrame` is not available, the
  default stays "no throttle" so server-side consumers still observe every
  parser mutation. Opt out with `{ throttle: false }`.

  Existing callers that explicitly passed `{ throttle: 'raf' }` continue to
  work; they can drop the option for the same behavior.

### Added

- TypeScript declarations (`index.d.ts`, `node.d.ts`, `parser.d.ts`,
  `picker.d.ts`, `path.d.ts`) covering the full public API.
- New `LiveSnapshot<T>` type exported from `fetchstream-js` describing the
  `{ data, chunks, done, path }` wrapper handed to `live`/`onProgress`
  callbacks.
- `live(cb, options?)` and `onProgress(path, cb, options?)` accept a
  `{ throttle }` option:
  - `'raf'` — coalesce updates to one delivery per animation frame
    (uses `requestAnimationFrame`; default in browsers).
  - `<number>` — coalesce over N milliseconds.
  - `false` / `null` — fire on every parser mutation (default in Node/SSR).
  - The very last update is flushed synchronously when the stream ends, so
    consumers always observe the final state before `done` resolves.
- Subpath export `fetchstream-js/picker` and explicit conditional exports map
  with `types`/`import`/`default` for every entry point.
- `prepublishOnly` runs the test suite before any `npm publish`.
- LICENSE file (MIT) shipped in the package tarball.
- `CHANGELOG.md`.

### Changed

- `fetchStream(input, init)` is now documented and typed as
  `fetchStream(resource, options)`, mirroring the WHATWG `fetch()` signature
  exactly: `resource: string | URL | Request`, `options: RequestInit`
  (including `signal`, `priority`, `keepalive`, …).

### Fixed

- The deferred microtask that started the producer no longer creates a
  second uncaught rejection chain when the handle errors.
- Non-2xx responses now `cancel()` the body so it doesn't dangle on the
  runtime's I/O layer.
- `feed`, `feedText`, and `end` are no-ops after the handle has errored,
  preventing a stale producer from throwing into a stream the consumer
  has already given up on.
- `_error` is idempotent (a second call neither double-rejects nor throws).

## [0.1.0] - initial preview release

- Streaming JSON parser (`JSONStreamParser`) with cross-chunk-safe strings,
  numbers, keywords, and surrogate pairs.
- Path picker (`StreamPicker`) with JSONPath-lite syntax (`$`, `.key`,
  `.*`, `[*]`, `[N]`, `["quoted"]`).
- High-level `fetchStream`, `streamJSON`, `parse`, and `streamFrom`
  (Node / Web `ReadableStream` / async iterable) APIs.
- Per-match (`.on`), progressive (`.onProgress`), live-mirror (`.live`),
  and async-iterator (`.iterate`) consumption modes.
