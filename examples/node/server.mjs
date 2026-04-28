// A tiny Node HTTP server that streams a large JSON payload SLOWLY,
// chunk by chunk. Use it to see fetchstream emit values as bytes arrive.
//
//   pnpm demo:server
//   curl http://localhost:8787/data
//   open examples/browser/browser.html in a browser

import http from 'node:http';

const PORT = process.env.PORT ? Number(process.env.PORT) : 8787;
const TOTAL_ITEMS = 200;
const ITEM_DELAY_MS = 25;       // pause between items
const ITEMS_PER_CHUNK = 1;      // smaller -> "drippier" stream

const indexHtml = `<!doctype html>
<title>fetchstream demo</title>
<meta charset="utf-8">
<style>
  body{font:14px system-ui,sans-serif;max-width:760px;margin:2rem auto;padding:0 1rem}
  pre{background:#f5f5f5;padding:8px;border-radius:6px;overflow:auto}
  a{color:#06f}
</style>
<h1>fetchstream demo server</h1>
<p>This server streams <code>application/json</code> with one item every ${ITEM_DELAY_MS} ms.</p>
<ul>
  <li><a href="/data">/data</a> &mdash; the JSON stream (${TOTAL_ITEMS} items)</li>
  <li>Open <code>examples/browser/browser.html</code> (per-match) or <code>examples/browser/live-browser.html</code> (live mirror) to see fetchstream consume it incrementally.</li>
</ul>`;

const server = http.createServer(async (req, res) => {
  if (req.url === '/' || req.url === '/index.html') {
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' });
    res.end(indexHtml);
    return;
  }
  if (req.url !== '/data') {
    res.writeHead(404);
    res.end('not found');
    return;
  }

  res.writeHead(200, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'access-control-allow-origin': '*',
  });

  res.write('{\n  "status": "ok",\n  "totalItems": ' + TOTAL_ITEMS + ',\n  "results": [\n');

  for (let i = 0; i < TOTAL_ITEMS; i++) {
    const obj = {
      id: i,
      name: 'Item ' + i,
      score: Math.round(Math.random() * 1000),
      tags: ['alpha', 'beta', 'gamma'].slice(0, (i % 3) + 1),
      createdAt: new Date(Date.now() - i * 60_000).toISOString(),
    };
    const piece = '    ' + JSON.stringify(obj) + (i === TOTAL_ITEMS - 1 ? '\n' : ',\n');
    res.write(piece);
    if ((i + 1) % ITEMS_PER_CHUNK === 0) {
      await new Promise(r => setTimeout(r, ITEM_DELAY_MS));
    }
  }

  res.end('  ],\n  "meta": { "generatedAt": "' + new Date().toISOString() + '" }\n}\n');
});

server.listen(PORT, () => {
  console.log(`fetchstream demo server: http://localhost:${PORT}`);
  console.log(`  /        -> info page`);
  console.log(`  /data    -> slow JSON stream (${TOTAL_ITEMS} items, ${ITEM_DELAY_MS}ms each)`);
});
