---
layout: home

hero:
  name: fetchstream-js
  text: Streaming JSON parser
  tagline: Emit values as bytes arrive — no waiting for JSON.parse on 5 MB payloads.
  image:
    src: /logo.svg
    alt: fetchstream-js
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: View on GitHub
      link: https://github.com/eklavya-raj/fetchstream-js

features:
  - icon: ⚡
    title: 260× faster time-to-first-value
    details: Parse byte-by-byte. Render the first row in ~12 ms against a 5 MB response that JSON.parse holds up for 3 seconds.
  - icon: 🎯
    title: Selective materialization
    details: Subscribe to JSONPath-lite expressions like `$.users.*`. Only those subtrees are built — the rest is parsed but skipped.
  - icon: 🪶
    title: Zero dependencies, ~12 KB
    details: Pure JavaScript, native fetch, native TextDecoder. Works in browsers and Node 18+ without a build step.
  - icon: 🧵
    title: Cross-chunk safe
    details: Strings, numbers, keywords, surrogate pairs, escapes — all handled whether they fit in one chunk or span many.
  - icon: ⚛️
    title: React-ready out of the box
    details: Live mirror mode with built-in `requestAnimationFrame` throttling. One render per frame, even at 10k+ matches.
  - icon: 🔌
    title: Two complementary patterns
    details: Per-match callbacks for one-shot subtrees, or a live mirror that grows the same object reference in place.
---

<style>
.VPHome .VPFeatures .items .item .VPFeature .icon {
  font-size: 24px;
}
</style>

## Quick taste

```js
import { fetchStream } from "fetchstream-js";

// Each user renders as soon as its closing `}` arrives.
await fetchStream("/api/users")
  .on("$.users.*", (user) => render(user))
  .on("$.meta", (meta) => setMeta(meta))
  .on("$.totalCount", (n) => setCount(n));
```

Or use a live mirror that matches your final document shape as it grows:

```js
await fetchStream("/api/data").live(
  (root) => {
    // `root` is the same reference every call, growing in place.
    // Perfect for React / Vue / Svelte progressive rendering.
    render(root);
  },
  { throttle: "raf" },
);
```

## Why bother?

`JSON.parse` is fast — but it requires the **entire** response before returning anything. For a 3 MB list streamed over a slow network, that's a 3-second blank screen.

`fetchstream-js` parses byte-by-byte. By the time the first 16 KB arrives, you can already render the first dozen rows.

<div style="margin-top: 2rem; padding: 1rem; border: 1px solid var(--vp-c-divider); border-radius: 8px;">

### Benchmark — 20 000 items, 16 KiB chunks @ 4 ms

| Approach                    | First item | Last item |
| --------------------------- | ---------: | --------: |
| `JSON.parse` after fetch    |   ~3134 ms |   3134 ms |
| `fetchStream` `$.results.*` |     ~12 ms |   3116 ms |

</div>

Same total finish time — we're network-bound either way — but **~260× faster time-to-first-value**.
