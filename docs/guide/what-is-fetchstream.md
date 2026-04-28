# What is fetchstream?

`fetchstream` is a **streaming JSON parser** that lets your application consume `application/json` responses incrementally — as bytes arrive from the network — rather than waiting for the entire response body before calling `JSON.parse`.

It sits directly on top of the native `fetch()` body stream in browsers and Node 18+.

## The problem

The browser's built-in `JSON.parse` is fast, but it requires the **entire** response string in memory before it can return anything:

```js
// ❌ Blocks the UI for seconds on large responses
const res = await fetch("/api/products");
const data = await res.json(); // waits for all 5 MB
render(data);                  // THEN renders
```

For a 5 MB JSON list over a slow network, that's a 3-second blank screen.

## The fix

`fetchstream` parses JSON incrementally from the raw byte stream, emitting values the moment they complete:

```js
// ✅ Renders each product as its `}` arrives over the wire
import { fetchStream } from "fetchstream";

await fetchStream("/api/products").on("$.products.*", (product) => {
  render(product);
});
```

First row paints in **milliseconds** instead of seconds.

## How it works

1. `fetchStream(url)` starts a native `fetch()` and gets a body `ReadableStream`
2. Each chunk (`Uint8Array`) is fed into a hand-rolled state machine
3. The parser emits SAX-like events (`onStartObject`, `onKey`, `onValue`, ...)
4. A **picker** layer watches the path stack and only materializes subtrees you subscribed to
5. Completed matches fire your callback — or the **live mirror** grows the root object in place

## Two complementary patterns

### 1. Per-match callbacks

Fire once per fully-formed subtree. Perfect for appending to a list:

```js
fetchStream(url).on("$.items.*", (item) => list.push(item));
```

### 2. Live mirror

A single `root` object that grows as the document streams in, mutation by mutation:

```js
fetchStream(url).live((root) => render(root), { throttle: "raf" });
```

The shape of `root` mid-stream matches the shape of your final document, just incomplete.

## What it is _not_

- ❌ Not a JSON Lines (NDJSON) parser — it reads a single `application/json` document
- ❌ Not a JSONPath implementation — it supports a deliberately small, fast subset (no recursive descent `..`)
- ❌ Not faster than `JSON.parse` for small payloads or when you need the whole document before doing anything

Use `fetchstream` when **time-to-first-value** matters.
