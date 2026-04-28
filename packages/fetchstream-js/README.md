# fetchstream-js

> **A drop-in replacement for `fetch()` and `axios.get()` for JSON endpoints.** Your UI sees data the moment the first bytes land on the wire — not after the full response finishes downloading.

📖 **[Documentation & API reference](https://eklavya-raj.github.io/fetchstream-js/)** · 🚀 **[Live React demo](https://fetchstream-js.vercel.app/)**

```js
// ❌ fetch — blocks for the full download
const data = await fetch("/api/users").then((r) => r.json()); // ⏳ 3 s
render(data);

// ❌ axios — same problem
const { data } = await axios.get("/api/users"); // ⏳ 3 s
render(data);

// ✅ fetchstream-js — renders as bytes arrive, first row in ~120 ms
import { fetchStream } from "fetchstream-js";
fetchStream("/api/users").live(({ data }) => render(data));
```

- **Same signature as `fetch()`.** Takes a URL + `RequestInit`. Uses `AbortController`. If you know `fetch`, you're done.
- **One-line React integration.** `.live(setState)` — the callback receives a fresh `{ data, chunks, done }` wrapper, so React re-renders naturally. rAF throttling is the default in browsers.
- **Pure JavaScript, zero dependencies, ~12 KB** unminified. Works in browsers and Node 18+ with no build step.
- **Plain `application/json`** — not just NDJSON / JSON Lines. Works with the JSON your existing APIs already return.
- **Selective materialization**: subscribe to JSONPath-lite expressions like `$.users.*` and only those subtrees are built — the rest is parsed but skipped.
- **Cross-chunk-safe**: strings, numbers, keywords, surrogate pairs, escapes — all correct whether they fit in one chunk or span many.

---

## Why replace fetch / axios?

Both `fetch().json()` and `axios.get()` buffer the **entire** response body before they return anything. For a 3 MB JSON list over a real network, that's a **3-second blank screen** before your user sees a single row — even though the first row's bytes arrived in the first ~100 ms.

`fetchstream-js` uses the same network call, the same endpoint, the same `RequestInit` options — but parses the body byte-by-byte as it streams in. Values fire the moment their closing `}` arrives, so your UI paints progressively instead of blocking on the slowest byte.

### Benchmark — 5 MB JSON list, 16 KiB chunks @ 4 ms network

| Approach                              | Time to first row | Time to last row |
| ------------------------------------- | ----------------: | ---------------: |
| `fetch().then(r => r.json())`         |         ~3 100 ms |        ~3 100 ms |
| `axios.get(url)`                      |         ~3 100 ms |        ~3 100 ms |
| **`fetchStream(url).live(setState)`** |       **~120 ms** |        ~3 100 ms |

Total finish time is identical — we're network-bound either way. But users see rows **~25× sooner**, which is the metric that actually moves perceived performance.

---

## React in 8 lines

```tsx
import { fetchStream } from "fetchstream-js";
import { useEffect, useState } from "react";

export function Users() {
  const [snap, setSnap] = useState({ data: null, chunks: 0, done: false });
  useEffect(() => {
    const ac = new AbortController();
    fetchStream("/api/users", { signal: ac.signal }).live(setSnap);
    return () => ac.abort();
  }, []);
  return <pre>{JSON.stringify(snap.data, null, 2)}</pre>;
}
```

No spread, no reducers, no `useRef` gymnastics, no manual `requestAnimationFrame`. The callback receives a fresh `{ data, chunks, done, path }` wrapper each tick (so `setSnap` re-renders), while `snap.data` is the same in-place-mutating tree (so reads stay zero-copy). The library already coalesces updates to one render per frame in browsers. See the [React guide](https://eklavya-raj.github.io/fetchstream-js/guide/react) for list/cards/hooks patterns.

---

## Install

```bash
npm install fetchstream-js
```

Requires Node 18+ (for global `fetch`) or any modern browser.

---

## Quick start

### Browser / Node — fetch a URL

```js
import { fetchStream } from "fetchstream-js";

const stream = fetchStream("/api/products", {
  headers: { authorization: "Bearer ..." },
});

stream.on("$.products.*", (product) => {
  // fires once per product, as soon as the `}` for that product arrives
  console.log(product.id, product.name);
});

stream.on("$.meta", (meta) => {
  // fires once with the whole "meta" subtree
  console.log("meta", meta);
});

await stream; // resolves when the response is fully consumed
```

### Async iteration

```js
for await (const product of fetchStream("/api/products").iterate(
  "$.products.*",
)) {
  await render(product); // automatic backpressure-friendly
}
```

### Node — pipe a `Readable` (or any async iterable)

```js
import { streamFrom } from "fetchstream-js/node";
import { createReadStream } from "node:fs";

await streamFrom(createReadStream("huge.json")).on("$.records.*", (record) =>
  process(record),
);
```

### Manual feeding

```js
import { streamJSON } from "fetchstream-js";

const s = streamJSON();
s.on("$.users.*", (u) => console.log(u));
s.feed(uint8ArrayChunk1);
s.feed(uint8ArrayChunk2);
s.end();
await s;
```

---

## Live mirror mode (`live` / `onProgress` / `snapshot`)

If you want the _whole_ JSON document available on the UI **as it streams in**,
use `live(callback)`. The callback receives a fresh wrapper:

```ts
{
  data:   T,        // the live mutating tree (same reference each tick)
  chunks: number,   // per-subscription delivery counter (1, 2, 3, ...)
  done:   boolean,  // true on the final delivery for this subscription
  path:   PathStack // where this subscription matched
}
```

`data` mutates in place across ticks (zero-copy, O(1) updates). The wrapper
itself is freshly allocated each tick, so passing it directly to React's
`setState` works without spreading or version counters.

### 1. Root object with keyed entries

Streamed JSON:

```json
{
  "user1": { "name": "Alex", "age": 22 },
  "user2": { "name": "Sam", "age": 25 },
  "user3": { "name": "John", "age": 28 }
}
```

What `data` looks like over time:

```js
fetchStream(url).live(({ data }) => {
  // 1st commit: { user1: { name: "Alex", age: 22 } }
  // 2nd commit: { user1: {...},          user2: { name: "Sam", age: 25 } }
  // 3rd commit: { user1: {...}, user2: {...}, user3: { name: "John", age: 28 } }
});
```

### 2. Root array of objects

Streamed JSON:

```json
[
  { "name": "Alex", "age": 22 },
  { "name": "Sam", "age": 25 },
  { "name": "John", "age": 28 }
]
```

What `data` looks like over time:

```js
fetchStream(url).live(({ data }) => {
  // 1st commit: [{ name: "Alex", age: 22 }]
  // 2nd commit: [{ name: "Alex", age: 22 }, { name: "Sam", age: 25 }]
  // 3rd commit: [{ name: "Alex", age: 22 }, { name: "Sam", age: 25 }, { name: "John", age: 28 }]
});
```

### 3. Nested object with multiple arrays

Streamed JSON:

```json
{
  "students": [{ "name": "Alex" }, { "name": "Sam" }],
  "teachers": [{ "name": "David" }, { "name": "Emma" }],
  "admins": [{ "name": "Mike" }, { "name": "Sara" }]
}
```

What `data` looks like over time:

```js
fetchStream(url).live(({ data }) => {
  // First visible "complete shape":
  //   { students: [{ name: "Alex" }] }
  // Then:
  //   { students: [{ name: "Alex" }, { name: "Sam" }] }
  // Then:
  //   { students: [...], teachers: [{ name: "David" }] }
  // ... continues until the document is fully built.
});
```

### Variations

| Method                                | When the callback fires                                                                |
| ------------------------------------- | -------------------------------------------------------------------------------------- |
| `.live(cb, options?)`                 | every mutation of the entire document tree                                             |
| `.onProgress('$.path', cb, options?)` | every mutation of just the subtree at `$.path` (e.g. `$.students` grows independently) |
| `.snapshot`                           | getter — reach in and read the current tree at any time, even after `await`            |

The same `data` reference is handed to you on every call, so you can read
through it freely. The wrapper is fresh each tick — perfect for `setState`.

### Built-in `requestAnimationFrame` throttling (default in browsers)

For very fast streams, every byte boundary can produce a parser mutation —
that's far more often than a UI needs to re-render. **In browsers,
`fetchstream-js` defaults to `{ throttle: 'raf' }`** so your callback fires
at most once per animation frame. The very last update is always flushed
synchronously when the stream ends, so the consumer is guaranteed to observe
the final state (with `done: true`) before `done` resolves.

In Node / SSR (no `requestAnimationFrame`), the default is no throttle: every
parser mutation produces a delivery, which is what server-side consumers
typically want.

```js
// Browser: rAF throttling is automatic.
fetchStream(url).live(({ data }) => render(data));

// Override to a fixed millisecond budget:
fetchStream(url).live(({ data }) => render(data), { throttle: 50 });

// Disable throttling entirely (fire on every mutation):
fetchStream(url).live(({ data }) => render(data), { throttle: false });

// Same option on subtree progress callbacks:
fetchStream(url).onProgress("$.products", ({ data: arr }) => render(arr));
```

```jsx
// React example -- no useRef / useReducer / manual rAF / spread needed.
function App() {
  const [snap, setSnap] = useState({ data: undefined, chunks: 0, done: false });
  useEffect(() => {
    const ac = new AbortController();
    fetchStream("/api/data", { signal: ac.signal }).live(setSnap);
    return () => ac.abort();
  }, []);
  return <pre>{JSON.stringify(snap.data, null, 2)}</pre>;
}
```

---

## Path syntax

Path expressions are a deliberately small, fast subset of JSONPath:

| Expression            | Meaning                                                    |
| --------------------- | ---------------------------------------------------------- |
| `$`                   | The root value                                             |
| `$.foo`               | Object property `foo` of the root                          |
| `$.a.b.c`             | Nested keys                                                |
| `$.list.*`            | Every value of `list` (object value or array element)      |
| `$.list[*]`           | Same as `.* `                                              |
| `$.list[7]`           | Specific array index                                       |
| `$["weird key.name"]` | Bracket-quoted key (allows dots, brackets, spaces in name) |

Recursive descent (`..`) is intentionally not supported — it would require
keeping the whole document in memory.

### Real-world shapes

`fetchstream-js` handles every JSON shape you'd see in the wild:

```js
// flat objects
fetchStream(url).on('$.id', id => …).on('$.name', n => …);

// flat arrays of primitives
fetchStream(url).on('$.tags.*', tag => …);

// arrays of objects
fetchStream(url).on('$.users.*', user => …);

// envelope + payload
fetchStream(url)
  .on('$.status',    s => …)
  .on('$.data.*',    item => …)
  .on('$.errors.*',  e => …);

// deeply nested
fetchStream(url).on('$.report.sections.*.rows.*', row => …);

// arrays at the root
fetchStream(url).on('$.*', item => …);
```

---

## API

### `fetchStream(resource, options?) -> StreamHandle`

Mirrors the [WHATWG `fetch()` signature](https://developer.mozilla.org/en-US/docs/Web/API/Window/fetch)
exactly:

- `resource` — `string`, `URL`, or `Request`
- `options` — a `RequestInit` dictionary (`method`, `headers`, `body`, `mode`,
  `credentials`, `cache`, `redirect`, `referrer`, `referrerPolicy`,
  `integrity`, `keepalive`, `signal`, `priority`, …)

Returns a `StreamHandle` that exposes `.on(path, cb)`, `.onProgress`, `.live`,
`.iterate(path)`, and is itself a Promise that resolves when the response is
fully consumed. Aborting via `options.signal` propagates through the body
reader and rejects the handle.

```js
const ac = new AbortController();
fetchStream("/api/products", {
  method: "GET",
  headers: { authorization: "Bearer …" },
  signal: ac.signal,
}).on("$.products.*", render);

// later
ac.abort();
```

### `streamJSON() -> StreamHandle`

Create a handle without fetching. Feed bytes manually with `.feed(bytes)` and
finalize with `.end()`.

### `streamFrom(source) -> StreamHandle` _(Node)_

Adapter for Node `Readable`, Web `ReadableStream`, or any async iterable
producing `Uint8Array` / `Buffer` / `string`.

### `StreamHandle`

| Member                            | Description                                                                                                                                                                        |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `.on(path, callback)`             | Subscribe to a path. `callback(value, path)` fires once per fully-formed match.                                                                                                    |
| `.onProgress(path, cb, options?)` | Subscribe to a path; `cb({ data, chunks, done, path })` fires on every mutation as the subtree grows. `options.throttle` defaults to `'raf'` in browsers; pass `false` to disable. |
| `.live(cb, options?)`             | Sugar for `.onProgress('$', cb, options)` — a live mirror of the whole document.                                                                                                   |
| `.snapshot`                       | Getter for the current partial (or final) live root.                                                                                                                               |
| `.iterate(path)`                  | Returns an `AsyncIterable` that yields each match.                                                                                                                                 |
| `.feed(uint8Array)`               | Push more bytes into the parser.                                                                                                                                                   |
| `.feedText(string)`               | Convenience: encode + feed.                                                                                                                                                        |
| `.end()`                          | Finalize the stream.                                                                                                                                                               |
| `.then` / `.catch` / `.finally`   | Awaitable; resolves when the stream ends.                                                                                                                                          |
| `.done`                           | The underlying Promise.                                                                                                                                                            |

### `parse(text) -> JSONValue`

A synchronous one-shot parse using the streaming parser. Equivalent to
`JSON.parse` for any complete, valid JSON string — mainly useful for tests
and small utilities. Prefer `JSON.parse` for raw speed on whole strings.

```js
import { parse } from "fetchstream-js";

parse('{"hello": "world"}'); // -> { hello: 'world' }
```

### Subpath imports

| Import path             | Provides                                                  |
| ----------------------- | --------------------------------------------------------- |
| `fetchstream-js`        | `fetchStream`, `streamJSON`, `parse`, `StreamHandle`      |
| `fetchstream-js/node`   | Everything above plus `streamFrom(source)`                |
| `fetchstream-js/parser` | `JSONStreamParser` (low-level SAX)                        |
| `fetchstream-js/picker` | `StreamPicker` (path-aware materializer)                  |
| `fetchstream-js/path`   | `compilePath`, `matches`, `prefixMatches`, `pathToString` |

### Low-level: `JSONStreamParser`

If you want raw SAX-style events (no path matching, no value materialization):

```js
import { JSONStreamParser } from 'fetchstream-js/parser';

const parser = new JSONStreamParser({
  onStartObject() { … },
  onEndObject()   { … },
  onStartArray()  { … },
  onEndArray()    { … },
  onKey(name)     { … },
  onValue(value)  { … },   // string | number | boolean | null
  onEnd()         { … },
  onError(err)    { … },
});
parser.write(uint8Array);   // call repeatedly
parser.end();
```

---

## Run the demos

From the monorepo root:

```bash
pnpm install            # one-time, links workspaces
pnpm demo:server        # slow JSON stream on http://localhost:8787
pnpm demo:node          # Node consumer (per-match)
pnpm demo:live          # Node consumer (live mirror)
pnpm dev:react          # React + Vite demo on http://localhost:5173
# or open examples/browser/browser.html      (per-match, two-pane)
# or open examples/browser/live-browser.html (live mirror)
```

The browser demo shows two panes side-by-side: `JSON.parse` waiting for the
whole body vs `fetchStream` rendering items as they arrive.

---

## Run the tests / benchmarks

```bash
pnpm -F fetchstream-js test     # or:  npm test       (inside packages/fetchstream-js)
pnpm -F fetchstream-js bench    # or:  npm run bench
```

---

## Design notes

- **State machine over bytes.** The parser is a single hand-rolled state
  machine that consumes `Uint8Array` chunks. JSON's structural characters
  (`{ } [ ] , : "`) are all ASCII (< `0x80`), so they can never collide with
  UTF-8 continuation bytes — we can scan strings byte-by-byte and only invoke
  `TextDecoder` once per string, on the closing `"`. That's the hottest hot
  path and it lives almost entirely in native code.
- **Cross-chunk safety.** Strings, numbers, and keyword literals can be split
  across any number of chunks. Partial byte slices are stitched together and
  decoded once on completion to keep multi-byte UTF-8 intact.
- **Selective materialization.** The picker layer only constructs the subtrees
  the user asked for. A subscription on `$.users.*` does **not** allocate
  objects for sibling envelope keys it doesn't care about — they pass through
  the parser as raw events and are dropped.
- **No external deps.** Just `TextDecoder`, `TextEncoder`, and `fetch` — all
  native.

## License

MIT.
