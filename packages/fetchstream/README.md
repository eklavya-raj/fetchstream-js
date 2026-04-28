# fetchstream

**High-performance streaming JSON parser for `application/json`.**
Emits values as bytes arrive — no waiting for the full response.

📖 **[Documentation & API reference](https://eklavya-raj.github.io/fetchstream/)**

- Pure JavaScript, zero dependencies, ~12 KB unminified
- Works with **plain `application/json`** (not just NDJSON / JSON Lines)
- Uses the native `fetch()` body stream in browsers and Node 18+
- Operates on raw `Uint8Array` chunks; UTF-8 fast path via native `TextDecoder`
- **Selective materialization**: subscribe to JSONPath-lite expressions like
  `$.users.*` and only those subtrees are built — the rest is parsed but skipped
- Cross-chunk-safe: strings, numbers, keywords, surrogate pairs, escapes — all
  work whether they fit in one chunk or are split across many

Two complementary patterns are supported:

```js
import { fetchStream } from "fetchstream";

// 1) Per-match callbacks: fire once per matching subtree.
await fetchStream("/api/users")
  .on("$.users.*", (user) => render(user)) // each user as soon as its `}` arrives
  .on("$.meta", (meta) => setMeta(meta)) // arrives once
  .on("$.totalCount", (n) => setCount(n)); // arrives once, very early

// 2) Live mirror: the SAME object grows in place as bytes arrive.
//    Perfect for rendering a progressive view of the document.
await fetchStream("/api/users").live((root) => {
  // root has the same shape as the final JSON, just incomplete until done.
  // First call:  { users: [{ name: "Alex", age: 22 }] }
  // Next call:   { users: [{ name: "Alex", age: 22 }, { name: "Sam", age: 25 }] }
  // ...and so on, until the document is complete.
  render(root);
});
```

---

## Why?

`JSON.parse` is fast — but it requires the **entire** response to be in memory
before it can return anything. For a 3 MB JSON list streamed over a slow
network, that's a 3-second wait before your UI sees a single row.

`fetchstream` parses byte-by-byte. By the time the network has delivered the
first 16 KB, you can already render the first dozen items.

### Benchmark — 20 000 items, 16 KiB chunks @ 4 ms (~3.2 MB total)

| Approach                    | First item | Last item |
| --------------------------- | ---------: | --------: |
| `JSON.parse` after fetch    |   ~3134 ms |   3134 ms |
| `fetchStream` `$.results.*` |     ~12 ms |   3116 ms |

That's a **~260× faster time-to-first-value**. The total finish time is the
same (we're network-bound either way) but the user sees data immediately.

---

## Install

```bash
npm install fetchstream
```

Requires Node 18+ (for global `fetch`) or any modern browser.

---

## Quick start

### Browser / Node — fetch a URL

```js
import { fetchStream } from "fetchstream";

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
import { streamFrom } from "fetchstream/node";
import { createReadStream } from "node:fs";

await streamFrom(createReadStream("huge.json")).on("$.records.*", (record) =>
  process(record),
);
```

### Manual feeding

```js
import { streamJSON } from "fetchstream";

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
use `live(callback)`. The callback receives a single mutable `root` object
that grows in place; each call gives you the latest partial tree, with the
exact same shape your final document will have.

### 1. Root object with keyed entries

Streamed JSON:

```json
{
  "user1": { "name": "Alex", "age": 22 },
  "user2": { "name": "Sam", "age": 25 },
  "user3": { "name": "John", "age": 28 }
}
```

What `root` looks like over time:

```js
fetchStream(url).live((root) => {
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

What `root` looks like over time:

```js
fetchStream(url).live((root) => {
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

What `root` looks like over time:

```js
fetchStream(url).live((root) => {
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

The same `root` reference is given to you on every call, so you can stash it
once and just trigger a re-render.

### Built-in `requestAnimationFrame` throttling

For very fast streams, every byte boundary can produce a parser mutation —
that's far more often than a UI needs to re-render. Pass `{ throttle: 'raf' }`
and `fetchstream` will coalesce updates so your callback fires at most once
per animation frame (`requestAnimationFrame` in browsers, ~16ms `setTimeout`
fallback in Node/SSR). The very last update is always flushed synchronously
when the stream ends, so the consumer is guaranteed to observe the final
state before `done` resolves.

```js
fetchStream(url).live((root) => render(root), { throttle: "raf" });

// Or: a fixed millisecond budget instead of rAF
fetchStream(url).live((root) => render(root), { throttle: 50 });

// Same option on subtree progress callbacks:
fetchStream(url).onProgress("$.products", (arr) => render(arr), {
  throttle: "raf",
});
```

```jsx
// React example -- no useRef / useReducer / manual rAF needed.
function App() {
  const [snap, setSnap] = useState({ root: undefined });
  useEffect(() => {
    const ac = new AbortController();
    fetchStream("/api/data", { signal: ac.signal }).live(
      (root) => setSnap({ root }),
      { throttle: "raf" },
    );
    return () => ac.abort();
  }, []);
  return <pre>{JSON.stringify(snap.root, null, 2)}</pre>;
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

`fetchstream` handles every JSON shape you'd see in the wild:

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

| Member                            | Description                                                                                                                              |
| --------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `.on(path, callback)`             | Subscribe to a path. `callback(value, path)` fires once per fully-formed match.                                                          |
| `.onProgress(path, cb, options?)` | Subscribe to a path; `cb(root, path)` fires on every mutation as the subtree grows. `options.throttle` may be `'raf'` or a number of ms. |
| `.live(cb, options?)`             | Sugar for `.onProgress('$', cb, options)` — a live mirror of the whole document.                                                         |
| `.snapshot`                       | Getter for the current partial (or final) live root.                                                                                     |
| `.iterate(path)`                  | Returns an `AsyncIterable` that yields each match.                                                                                       |
| `.feed(uint8Array)`               | Push more bytes into the parser.                                                                                                         |
| `.feedText(string)`               | Convenience: encode + feed.                                                                                                              |
| `.end()`                          | Finalize the stream.                                                                                                                     |
| `.then` / `.catch` / `.finally`   | Awaitable; resolves when the stream ends.                                                                                                |
| `.done`                           | The underlying Promise.                                                                                                                  |

### `parse(text) -> JSONValue`

A synchronous one-shot parse using the streaming parser. Equivalent to
`JSON.parse` for any complete, valid JSON string — mainly useful for tests
and small utilities. Prefer `JSON.parse` for raw speed on whole strings.

```js
import { parse } from "fetchstream";

parse('{"hello": "world"}'); // -> { hello: 'world' }
```

### Subpath imports

| Import path          | Provides                                                  |
| -------------------- | --------------------------------------------------------- |
| `fetchstream`        | `fetchStream`, `streamJSON`, `parse`, `StreamHandle`      |
| `fetchstream/node`   | Everything above plus `streamFrom(source)`                |
| `fetchstream/parser` | `JSONStreamParser` (low-level SAX)                        |
| `fetchstream/picker` | `StreamPicker` (path-aware materializer)                  |
| `fetchstream/path`   | `compilePath`, `matches`, `prefixMatches`, `pathToString` |

### Low-level: `JSONStreamParser`

If you want raw SAX-style events (no path matching, no value materialization):

```js
import { JSONStreamParser } from 'fetchstream/parser';

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
pnpm -F fetchstream test     # or:  npm test       (inside packages/fetchstream)
pnpm -F fetchstream bench    # or:  npm run bench
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
