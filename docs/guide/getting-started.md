# Getting started

## Install

::: code-group

```bash [npm]
npm install fetchstream
```

```bash [pnpm]
pnpm add fetchstream
```

```bash [yarn]
yarn add fetchstream
```

:::

**Requires** Node 18+ (global `fetch`) or any modern browser.

## Your first stream

```js
import { fetchStream } from "fetchstream";

await fetchStream("/api/users").on("$.users.*", (user) => {
  console.log(user.name);
});
```

That's it. Each user logs the moment its closing `}` arrives on the wire — long before the full response is downloaded.

## Pick a pattern

### A. Per-match callback

Use this when you want to handle items one at a time (e.g. append to a list, send each to a worker):

```js
fetchStream("/api/products")
  .on("$.products.*", (product) => renderProduct(product))
  .on("$.total", (n) => setTotal(n));
```

### B. Async iteration

Same idea, but with backpressure — `await render(product)` blocks the parser until your handler finishes:

```js
for await (const product of fetchStream("/api/products").iterate("$.products.*")) {
  await renderProduct(product);
}
```

### C. Live mirror

When you want the **whole document** available to a UI as it streams in:

```js
fetchStream("/api/data").live((root) => {
  // `root` is the same reference every call, growing in place.
  // Shape matches your final JSON exactly — just incomplete until done.
  render(root);
}, { throttle: "raf" });
```

`throttle: "raf"` coalesces parser updates into one callback per animation frame — perfect for React/Vue/Svelte.

## Common shapes

```js
// flat objects
fetchStream(url).on("$.id", (id) => { /* ... */ });

// flat arrays of primitives
fetchStream(url).on("$.tags.*", (tag) => { /* ... */ });

// arrays of objects
fetchStream(url).on("$.users.*", (user) => { /* ... */ });

// envelope + payload
fetchStream(url)
  .on("$.status", (s) => { /* ... */ })
  .on("$.data.*", (item) => { /* ... */ })
  .on("$.errors.*", (e) => { /* ... */ });

// deeply nested
fetchStream(url).on("$.report.sections.*.rows.*", (row) => { /* ... */ });

// arrays at the root
fetchStream(url).on("$.*", (item) => { /* ... */ });
```

See [Path syntax](/guide/paths) for the full specification.

## Abort

`fetchStream` mirrors the WHATWG `fetch()` signature, including `AbortSignal`:

```js
const ac = new AbortController();

fetchStream("/api/products", { signal: ac.signal })
  .on("$.products.*", render);

// Later — cancels the body reader and rejects the handle.
ac.abort();
```

## Next steps

- [Why streaming?](/guide/why-streaming) — the rationale + benchmarks
- [Path syntax](/guide/paths) — what `$.users.*` actually means
- [Live mirror mode](/guide/live-mode) — the React-friendly pattern
- [React integration](/guide/react) — full example with hooks
