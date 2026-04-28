---
layout: home

hero:
  name: fetchstream-js
  text: A drop-in replacement for fetch & axios
  tagline: Your UI sees data the moment the first bytes arrive — no waiting for the full response body like fetch().json() or axios.get() force you to.
  image:
    src: /logo.svg
    alt: fetchstream-js
  actions:
    - theme: brand
      text: React quick start
      link: /guide/react
    - theme: alt
      text: Why replace fetch/axios?
      link: /guide/what-is-fetchstream-js
    - theme: alt
      text: GitHub
      link: https://github.com/eklavya-raj/fetchstream-js

features:
  - icon: ⚛️
    title: One-line React integration
    details: "fetchStream(url).live(setSnap) — the callback receives a fresh { data, chunks, done } wrapper, so React re-renders naturally. rAF throttling is the default in browsers."
  - icon: ⚡
    title: Instant first paint
    details: fetch and axios block until the whole body downloads. fetchstream-js renders rows while the rest is still in flight — typically 100–300× faster time-to-first-row.
  - icon: 🎯
    title: Same API shape as fetch
    details: "fetchStream(url, init) accepts the full RequestInit — headers, method, body, signal, credentials. Swap it in where you already use fetch()."
  - icon: 🪶
    title: Zero dependencies, ~12 KB
    details: Pure JavaScript, native TextDecoder, native fetch. Works in browsers and Node 18+ without any build tooling.
  - icon: 🧵
    title: Works with any JSON shape
    details: Plain `application/json` — objects, nested arrays, envelopes, pagination payloads. Not just NDJSON or JSON Lines.
  - icon: 🔌
    title: Aborts, backpressure, streams
    details: "AbortController signals, async iteration for backpressure, and Node Readable / Web ReadableStream adapters out of the box."
---

<style>
.VPHome .VPFeatures .items .item .VPFeature .icon {
  font-size: 24px;
}
</style>

## The problem

`fetch()` and `axios.get()` both do the same thing: **wait for the entire response body to arrive**, then hand it to you as one blob. For a 3 MB JSON list on a slow network, that's a 3-second blank screen before your UI sees a single row.

```js
// fetch — waits for full body, then JSON.parse, then render.
const res = await fetch("/api/users");
const users = await res.json(); //  ⏳ 3 s on a 3 MB payload
render(users);
```

```js
// axios — same story.
const { data } = await axios.get("/api/users"); //  ⏳ 3 s on a 3 MB payload
render(data);
```

## The fix

`fetchstream-js` reads the response **as it streams in** and hands you values as soon as their closing `}` arrives. Same URL, same server, same bytes — but your first row paints in milliseconds.

```js
import { fetchStream } from "fetchstream-js";

await fetchStream("/api/users").live(({ data }) => render(data));
// rAF throttling is the default in browsers; one render per animation frame.
```

That's it — `.live()` hands you `{ data, chunks, done, path }` each tick. `data` is the same in-place-mutating tree (zero-copy reads); the wrapper itself is fresh, so React's `setState` re-renders without spread or counters.

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

No reducers, no refs, no manual `requestAnimationFrame`. The library already throttles for you.

## Benchmark — 5 MB JSON payload, real network

<div style="margin-top: 1rem; padding: 1rem; border: 1px solid var(--vp-c-divider); border-radius: 8px;">

| Approach                              | Time to first row | Time to last row |
| ------------------------------------- | ----------------: | ---------------: |
| `fetch().then(r => r.json())`         |         ~3 100 ms |        ~3 100 ms |
| `axios.get(url)`                      |         ~3 100 ms |        ~3 100 ms |
| **`fetchStream(url).live(setState)`** |       **~120 ms** |        ~3 100 ms |

</div>

Both finish at the same speed — the network hasn't changed. But your user sees rows **25× sooner**, which is the metric that actually matters for perceived performance.

👉 **[See the full React benchmark demo](https://fetchstream-js.vercel.app/)**

## Where to next?

- **[React quick start](/guide/react)** — the `.live()` hook pattern, ready to paste
- **[Live mirror mode](/guide/live-mode)** — how `.live()` coalesces updates
- **[Why streaming?](/guide/why-streaming)** — full comparison vs fetch / axios / JSON.parse
- **[API reference](/api/fetch-stream)** — every option, every method
