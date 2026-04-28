# Node consumer

A pair of Node CLI demos that consume a slow JSON server using `fetchStream`. Located at `examples/node/` in the repo.

## Run it

In one terminal:

```bash
pnpm run demo:server  # starts http://localhost:8787
```

In another terminal:

```bash
pnpm run demo:node    # per-match callbacks
# or
pnpm run demo:live    # live mirror
```

You'll see output appear progressively, matching the slow trickle of bytes from the demo server.

## Server

The demo server (`examples/node/server.mjs`) responds with a 5000-item JSON array, but throttled to one chunk per few hundred milliseconds. This simulates a slow real-world API.

```js
// roughly:
res.setHeader("content-type", "application/json");
res.write("[");
for (let i = 0; i < 5000; i++) {
  if (i > 0) res.write(",");
  res.write(JSON.stringify(makeItem(i)));
  await sleep(/* small delay */);
}
res.write("]");
res.end();
```

## Per-match consumer

```js
import { fetchStream } from "fetchstream";

const url = "http://localhost:8787/data";
let count = 0;
const t0 = performance.now();

await fetchStream(url).on("$.*", (item) => {
  count++;
  if (count === 1) {
    console.log(`First item after ${(performance.now() - t0).toFixed(0)} ms`);
  }
});

console.log(`Total: ${count} items in ${(performance.now() - t0).toFixed(0)} ms`);
```

Output:

```
First item after 47 ms
... items appearing as the server sends them ...
Total: 5000 items in 4982 ms
```

## Live consumer

```js
import { fetchStream } from "fetchstream";

let count = 0;
await fetchStream("http://localhost:8787/data").live(
  (root) => {
    if (Array.isArray(root) && root.length !== count) {
      count = root.length;
      process.stdout.write(`\r  ${count} items so far`);
    }
  },
  { throttle: 100 }, // re-render at most every 100 ms
);
console.log(`\nDone — ${count} items.`);
```

Output:

```
  4980 items so far
Done — 5000 items.
```

## Useful patterns this demonstrates

- **Backpressure-friendly bulk processing**: replace `console.log` with `await db.insert(item)` and you have a memory-safe ETL
- **Progress reporting**: `live` mode lets you show progress without buffering the whole response
- **Cancelable fetches**: pass `{ signal: ac.signal }` and abort on Ctrl+C
