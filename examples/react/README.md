# fetchstream vs fetch + JSON.parse — Next.js demo

A production-grade, side-by-side benchmark UI built with Next.js 16, React 19,
and Tailwind v4. Both panes hit the same dataset, read the same bytes, and
race to put rows on screen:

| Pane          | Strategy                                                                |
| ------------- | ----------------------------------------------------------------------- |
| **Classic**   | `fetch()` → buffer the whole body → `JSON.parse()` → render.            |
| **Streaming** | `fetch()` → feed bytes into `fetchstream` → render rows as they arrive. |

Dataset: [`microsoftedge.github.io/Demos/json-dummy-data/5MB.json`](https://microsoftedge.github.io/Demos/json-dummy-data/5MB.json)
(an array of ~10k objects, served with permissive CORS over GitHub Pages).

## Run it

From the monorepo root:

```bash
pnpm install     # links workspaces — picks up packages/fetchstream
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
app/
├── page.tsx                       # hero + composition
├── layout.tsx                     # metadata, fonts
├── globals.css                    # Tailwind v4 + indeterminate keyframe
├── lib/format.ts                  # bytes / ms / number / throughput formatters
└── components/
    ├── ComparisonDemo.tsx         # client orchestrator + both runners
    └── Pane.tsx                   # reusable benchmark pane
```

The two runners (`runClassic`, `runStream`) live in `ComparisonDemo.tsx` and
share the same `AbortController`, the same byte-counter strategy (so progress
bars are comparable), and the same item shape.
