# Examples

The repo ships several runnable examples under `examples/`. Pick one closest to your stack:

## React benchmark demo

A side-by-side comparison of `fetch + JSON.parse` vs `fetchStream` against a 5 MB JSON dataset, with live metrics, abort controls, and rAF-throttled card rendering. Built with **Next.js 16 + React 19 + Tailwind v4**.

```bash
pnpm install
pnpm run dev:react
# http://localhost:3000
```

[Walkthrough →](/examples/react)

## Node consumer

Per-match callback demo that streams a slow JSON server response.

```bash
pnpm install
pnpm run demo:server   # localhost:8787 — slow JSON stream
pnpm run demo:node     # consumer — per-match
pnpm run demo:live     # consumer — live mirror
```

[Walkthrough →](/examples/node)

## Vanilla browser

Two HTML files that compare classic `fetch().json()` against `fetchStream` in a plain browser context — no framework, no build step.

```bash
pnpm run demo:server
# then open:
#   examples/browser/browser.html      (per-match, two-pane)
#   examples/browser/live-browser.html (live mirror)
```

[Walkthrough →](/examples/browser)
