# fetchstream-js vs fetch / axios — Next.js benchmark demo

**🚀 Live demo:** [fetchstream-js.vercel.app](https://fetchstream-js.vercel.app/)

A production-grade, side-by-side benchmark UI built with Next.js 16, React 19,
and Tailwind v4. Both panes hit the **same endpoint**, download the **same
bytes**, and race to paint rows on screen — showing how `fetchstream-js`
replaces `fetch()` / `axios.get()` for JSON endpoints without changing anything
on the server.

| Pane          | Strategy                                                                                   |
| ------------- | ------------------------------------------------------------------------------------------ |
| **Classic**   | `await fetch(url).then(r => r.json())` — exactly what you'd write with `fetch` or `axios`. |
| **Streaming** | `fetchStream(url).live(setState, { throttle: "raf" })` — rows appear as bytes stream in.   |

Both approaches finish at the same network speed. The demo makes the gap in
**time-to-first-row** impossible to miss.

Dataset: [`microsoftedge.github.io/Demos/json-dummy-data/5MB.json`](https://microsoftedge.github.io/Demos/json-dummy-data/5MB.json)
(an array of ~10k objects, served with permissive CORS over GitHub Pages).

## Run it

From the monorepo root:

```bash
pnpm install     # links workspaces — picks up packages/fetchstream-js
pnpm -F react dev
```

Then open <http://localhost:3000>. Hit **Run benchmark** and watch the
streaming pane paint its first row long before the classic pane has finished
buffering.

## What you'll see

- **Time to first item** — the headline metric. Streaming typically shows row
  #1 while the classic pane is still downloading.
- **Total transfer time** — both finish at network speed. Streaming doesn't
  download faster, it just becomes _useful_ faster.
- **Live byte counter, throughput, item counter** — coalesced into a single
  React render per frame via a small `requestAnimationFrame` batcher so the UI
  stays smooth even at 10k matches.

## Where the code lives

```
examples/react/
├── app/
│   ├── page.tsx                   # hero + composition
│   ├── layout.tsx                 # metadata, fonts
│   ├── globals.css                # Tailwind v4 + indeterminate keyframe
│   └── types.ts                   # shared Item / Metrics types
├── components/
│   ├── ComparisonDemo.tsx         # client orchestrator (wires up both panes)
│   ├── BenchmarkPane.tsx          # one side of the side-by-side comparison
│   ├── DataCard.tsx               # individual row card
│   ├── MetricCard.tsx             # single metric tile (time / bytes / count)
│   ├── ProgressBar.tsx            # download progress indicator
│   ├── StatusBadge.tsx            # idle / running / done badge
│   ├── SummaryCard.tsx            # post-run takeaway (speedup factor)
│   └── Toolbar.tsx                # URL input, run/cancel, dataset picker
├── hooks/
│   ├── useClassicFetch.ts         # `fetch().then(r => r.json())` runner
│   └── useStreamFetch.ts          # `fetchStream(url).live(...)` runner
└── lib/
    └── format.ts                  # bytes / ms / number / throughput formatters
```

The two hooks (`useClassicFetch`, `useStreamFetch`) share the same
`AbortController` strategy and the same byte-counter logic, so progress bars
and metrics are directly comparable across the two panes.
