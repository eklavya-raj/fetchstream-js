// Node example: stream items as they arrive from the demo server.
//
// From the monorepo root, in two terminals:
//   pnpm demo:server      # starts the slow JSON server
//   pnpm demo:node        # runs THIS file

import { fetchStream } from 'fetchstream';

const URL = process.env.URL || 'http://localhost:8787/data';

console.log('GET ' + URL + '\n');
const t0 = performance.now();
let count = 0;

await fetchStream(URL)
  .on('$.totalItems', (n) => {
    console.log(`[+${(performance.now() - t0).toFixed(0)} ms] envelope: totalItems=${n}`);
  })
  .on('$.meta', (m) => {
    console.log(`[+${(performance.now() - t0).toFixed(0)} ms] envelope: meta=${JSON.stringify(m)}`);
  })
  .on('$.results.*', (item) => {
    count++;
    console.log(`[+${(performance.now() - t0).toFixed(0).padStart(5)} ms] item #${count}: id=${item.id} name="${item.name}"`);
  });

console.log(`\nDone. ${count} items processed in ${(performance.now() - t0).toFixed(0)} ms.`);
