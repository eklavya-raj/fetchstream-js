# What is fetchstream-js?

`fetchstream-js` is a **drop-in replacement for `fetch()` and `axios.get()`** for JSON endpoints. Same URL, same server, same `RequestInit` options — but instead of blocking until the full response body arrives, it hands you values **as bytes stream in**.

For any non-trivial JSON response (hundreds of KB and up), that's the difference between a blank screen for 2–3 seconds and a UI that paints its first row in ~100 ms.

## The problem with fetch and axios

Both `fetch().json()` and `axios.get()` buffer the **entire** response body before they return. You don't get any data — not one object, not one row — until the last byte has arrived.

```js
// ❌ fetch — UI blocks for the full download time
const res = await fetch("/api/products");
const data = await res.json(); // ⏳ waits for all 5 MB
render(data);
```

```js
// ❌ axios — identical behavior
const { data } = await axios.get("/api/products"); // ⏳ waits for all 5 MB
render(data);
```

For a 5 MB JSON list over a real network, that's a **3-second blank screen** before your user sees anything.

## The fix

`fetchstream-js` parses the response incrementally from the raw byte stream. Values fire the moment their closing `}` arrives on the wire — long before the server has finished writing the last byte.

```js
// ✅ Renders as bytes arrive — first row in ~120 ms
import { fetchStream } from "fetchstream-js";

await fetchStream("/api/products").live((root) => render(root), {
  throttle: "raf",
});
```

`.live()` is the headline API: it gives you the **same object reference** every call, mutated in place as the JSON tree grows. Perfect for React / Vue / Svelte state.

## Use it exactly like fetch

`fetchStream()` mirrors the WHATWG `fetch()` signature 1:1 — same URL types, same `RequestInit`, same `AbortController`. If you know `fetch()`, you already know this library.

```js
const ac = new AbortController();
fetchStream("/api/products", {
  method: "GET",
  headers: { authorization: "Bearer …" },
  signal: ac.signal,
}).live(setState, { throttle: "raf" });

// later…
ac.abort();
```

## How it works

1. `fetchStream(url)` starts a native `fetch()` and gets a body `ReadableStream`
2. Each chunk (`Uint8Array`) is fed into a hand-rolled state machine
3. The parser emits SAX-like events (`onStartObject`, `onKey`, `onValue`, ...)
4. A **picker** layer watches the path stack and only materializes subtrees you subscribed to
5. Completed matches fire your callback — or the **live mirror** grows the root object in place

## Two ways to consume the stream

### 1. `.live()` — the easy one (start here)

A single `root` object grows in place as the document streams in. Pass it to React state and you're done.

```js
fetchStream(url).live((root) => setState(root), { throttle: "raf" });
```

Built-in `requestAnimationFrame` throttling means one re-render per frame even if the parser mutates the tree thousands of times per second.

### 2. `.on(path, cb)` — per-match callbacks

Fire once per fully-formed subtree, e.g. to append items one-by-one:

```js
fetchStream(url).on("$.items.*", (item) => list.push(item));
```

Great when you don't want the whole tree in memory.

## When to use it

Use `fetchstream-js` instead of `fetch` / `axios` when the response is:

- A **list** (>50 rows) your UI renders progressively
- Any JSON payload where **time-to-first-row** beats total download time as the KPI
- A **slow backend** that generates data server-side and streams it out
- A payload you want to **cancel** mid-download if the user navigates away

Keep using `fetch` / `axios` for small responses (a single config object, a 5-row list, an auth token). The fixed parser overhead doesn't pay off at that size.

## What it is _not_

- Not a JSON Lines (NDJSON) parser — it reads plain `application/json`, the same content type `fetch().json()` handles
- Not a JSONPath implementation — it supports a deliberately small, fast subset (no recursive descent `..`)
- Not a general-purpose HTTP client — for multipart uploads, interceptors, request batching, stick with `axios` or `ky`

Ready to wire it up? → **[React quick start](/guide/react)**
