// Live-mirror example. The `data` object grows in place as bytes arrive;
// we print it every time a top-level item has been fully committed, so you
// can literally watch the JSON document assemble itself.
//
// From the monorepo root, in two terminals:
//   pnpm demo:server      # starts the slow JSON server
//   pnpm demo:live        # runs THIS file

import { fetchStream } from 'fetchstream-js';

const URL = process.env.URL || 'http://localhost:8787/data';

console.log('GET ' + URL + '\n');
const t0 = performance.now();

let updateCount = 0;
let lastShownSize = 0;

// `.live()` callback receives a fresh `{ data, chunks, done, path }` wrapper
// each delivery. `data` is the in-place-mutating root tree; `chunks` is a
// per-subscription delivery counter. In Node there's no rAF, so by default
// every parser mutation produces a delivery -- exactly what the demo wants.
await fetchStream(URL).live(({ data: root, chunks }) => {
  updateCount = chunks;
  if (!root || !Array.isArray(root.results)) return;
  const curSize = root.results.length;
  const last = root.results[curSize - 1];
  // only print when a new item is fully committed (its last field `createdAt` is set)
  if (curSize > lastShownSize && last && last.createdAt) {
    lastShownSize = curSize;
    const ms = (performance.now() - t0).toFixed(0).padStart(5);
    // freeze a display snapshot so the printed tree won't mutate further
    const frozen = JSON.parse(JSON.stringify(root));
    console.log(`[+${ms} ms] after commit #${curSize}, root =`);
    console.log(indent(JSON.stringify(frozen, null, 2), '  '));
    console.log('');
  }
});

console.log(`Total live-callback invocations: ${updateCount}`);

function indent(s, pad) {
  return s.split('\n').map(l => pad + l).join('\n');
}
