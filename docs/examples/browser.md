# Vanilla browser

Two static HTML pages that compare classic `fetch().json()` against `fetchStream` in a plain browser context — no framework, no build step, no bundler.

Located at `examples/browser/` in the repo.

## Run it

Start the slow JSON demo server:

```bash
pnpm run demo:server  # http://localhost:8787
```

Then open one of the HTML files in your browser:

- `examples/browser/browser.html` — per-match, two-pane comparison
- `examples/browser/live-browser.html` — live mirror version

## Per-match (`browser.html`)

Two side-by-side panes:

| Pane                 | Strategy                                       |
| -------------------- | ---------------------------------------------- |
| `fetch + JSON.parse` | Buffers the entire body, parses, then renders. |
| `fetchStream`        | Streams items as they arrive.                  |

```html
<script type="module">
  import { fetchStream } from "https://esm.sh/fetchstream-js";

  // Classic — blocks until the whole body arrives
  const t0 = performance.now();
  const res = await fetch("http://localhost:8787/data");
  const data = await res.json();
  console.log(`Classic done in ${performance.now() - t0} ms`);

  // Streaming — first row appears in milliseconds
  await fetchStream("http://localhost:8787/data").on("$.*", (item) => {
    appendRow(item);
  });
</script>
```

You'll see the streaming pane fill up with rows while the classic pane is still spinning.

## Live mirror (`live-browser.html`)

Same dataset, but using `live()` to mirror the whole document:

```html
<script type="module">
  import { fetchStream } from "https://esm.sh/fetchstream-js";

  fetchStream("http://localhost:8787/data").live(
    (root) => {
      // root is the same array reference each call, growing in place
      document.querySelector("#count").textContent =
        `${Array.isArray(root) ? root.length : 0} items`;
    },
    { throttle: "raf" },
  );
</script>
```

The page shows a counter ticking up as items stream in, throttled to one update per animation frame.

## What this proves

- `fetchstream-js` works **without** a build step — direct ES module imports from a CDN
- It works in **every modern browser** — Chrome, Safari, Firefox, Edge
- No special framework, no `node_modules`, no compilation
- Compare-and-contrast against the native `fetch().json()` flow side-by-side

## Going further

For a richer browser demo with metrics, abort controls, and a cards UI, see the [React benchmark demo](/examples/react).
