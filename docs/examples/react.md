# React benchmark demo

A production-grade Next.js 16 / React 19 example that benchmarks `fetch + JSON.parse` against `fetchStream` side-by-side. Located at `examples/react/` in the repo.

## Run it

```bash
pnpm install
pnpm run dev:react
# open http://localhost:3000
```

Hit **Run benchmark** — the streaming pane paints its first card while the classic pane is still buffering.

## What you'll see

Per pane:

- **Time to first item** — the headline metric. Streaming typically shows row #1 while the classic pane is still downloading.
- **Total time** — both finish at network speed. Streaming doesn't download faster, it just becomes _useful_ faster.
- **Bytes received** — wire bytes (`Content-Length`), identical across panes.
- **Items rendered** / **TTFB** / **Status** — live counters.

A summary card at the bottom computes the time-to-first-item speedup once both runs finish.

## Architecture

```
app/
├── page.tsx                          # hero + composition
├── layout.tsx
├── globals.css
├── types.ts                          # Item, Metrics, RunStatus, DATASET_URL
├── lib/format.ts                     # formatBytes / formatMs / formatNumber
├── hooks/
│   ├── useClassicFetch.ts            # fetch + json
│   └── useStreamFetch.ts             # fetchStream + live({ throttle: 'raf' })
└── components/
    ├── ComparisonDemo.tsx            # thin orchestrator
    ├── Toolbar.tsx                   # run / abort / reset + dataset chip
    ├── BenchmarkPane.tsx             # one pane: header + metrics + cards
    ├── MetricCard.tsx                # one labelled metric tile
    ├── DataCard.tsx                  # one data row as a card
    ├── StatusBadge.tsx               # idle / running / done / aborted / error
    ├── ProgressBar.tsx               # determinate or indeterminate
    └── SummaryCard.tsx               # post-run speedup card
```

## Classic side

Dead simple: `await fetch(url).then(r => r.json())`, then map over the result and render cards.

```ts
async function run(url: string) {
  const res = await fetch(url, { signal, cache: "no-store" });
  const ttfbMs = performance.now() - t0;
  const cl = Number(res.headers.get("content-length"));
  const data = (await res.json()) as Item[];
  const totalMs = performance.now() - t0;
  setState({
    data,
    metrics: {
      status: "done",
      ttfbMs,
      ttfiMs: totalMs, // first card painted only after JSON.parse finishes
      totalMs,
      bytes: cl,
      itemsRendered: data.length,
    },
  });
}
```

## Streaming side

Uses the headline `fetchStream(url)` API and the library's built-in `throttle: 'raf'`:

```ts
const handle = fetchStream(url, { signal, cache: "no-store" });

handle.live<Item[]>(
  (root) => {
    dataRef.current = Array.isArray(root) ? root : [];
    const len = dataRef.current.length;
    if (!firstItemSeen && len > 0) {
      firstItemSeen = true;
      setMetrics((m) => ({ ...m, ttfiMs: performance.now() - t0, itemsRendered: len }));
    } else {
      setMetrics((m) => (m.itemsRendered === len ? m : { ...m, itemsRendered: len }));
    }
    tick();
  },
  { throttle: "raf" },
);

await handle;
```

Notes:

- `dataRef` holds the live root — the parser mutates it in place
- `tick()` (a `useReducer` increment) forces a re-render once per animation frame
- No custom React rAF batcher — the library's `throttle: 'raf'` does the coalescing

## Why a side-channel HEAD?

The library hides the underlying `Response` (it owns the fetch + body reader internally). To still report a wire-accurate `bytes` value matching the classic pane, the streaming hook fires a parallel `HEAD` request:

```ts
fetch(url, { method: "HEAD", signal, cache: "no-store" })
  .then((res) => {
    const cl = Number(res.headers.get("content-length"));
    setMetrics((m) => ({ ...m, bytes: cl, ttfbMs: performance.now() - t0 }));
  })
  .catch(() => { /* best-effort */ });
```

This is the recommended pattern when you need response metadata that isn't part of the parsed JSON.

## Running the production build

```bash
pnpm run build:react   # next build
```

TypeScript / ESLint / Next prerender all pass clean.
