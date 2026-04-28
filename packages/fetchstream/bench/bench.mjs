// Benchmark: fetchstream vs JSON.parse
//
// Two scenarios, both measuring "wall time from first byte to first useful value":
//   1. Whole-document parse: matches what JSON.parse does (no streaming benefit visible).
//   2. Streaming source: chunks arrive at network-like speed.
//      Here fetchstream emits values mid-stream while JSON.parse is forced
//      to wait for the final byte.

import { performance } from 'node:perf_hooks';
import { JSONStreamParser } from '../src/parser.js';
import { StreamHandle } from '../src/index.js';

const enc = new TextEncoder();

// Build a realistic-shape JSON: a "results" array of N objects with mixed types,
// plus some envelope keys.
function makePayload(n) {
  const results = [];
  for (let i = 0; i < n; i++) {
    results.push({
      id: i,
      uuid: 'a'.repeat(8) + '-' + i.toString(16).padStart(4, '0'),
      name: 'Item ' + i,
      score: Math.random() * 1000,
      tags: ['alpha', 'beta', 'gamma'].slice(0, (i % 3) + 1),
      meta: { active: (i % 2) === 0, createdAt: '2024-01-01T00:00:00Z' },
    });
  }
  return JSON.stringify({
    status: 'ok',
    page: 1,
    pageSize: n,
    total: n,
    results,
    flags: { cached: false, partial: false },
  });
}

// ----- 1) Whole-doc parse, fairness comparison -----
function benchWhole(N) {
  const json = makePayload(N);
  const bytes = enc.encode(json);
  const ITER = 5;

  console.log(`\n--- Whole-document parse (${N.toLocaleString()} items, ${(bytes.length / 1024).toFixed(1)} KiB) ---`);

  // JSON.parse
  let t0 = performance.now();
  for (let k = 0; k < ITER; k++) JSON.parse(json);
  let t1 = performance.now();
  console.log(`JSON.parse():            ${((t1 - t0) / ITER).toFixed(2)} ms/iter`);

  // fetchstream full-tree (pick root)
  t0 = performance.now();
  for (let k = 0; k < ITER; k++) {
    const h = new StreamHandle();
    let r;
    h.on('$', v => { r = v; });
    h.feed(bytes);
    h.end();
    if (!r) throw new Error();
  }
  t1 = performance.now();
  console.log(`fetchstream $ (full):    ${((t1 - t0) / ITER).toFixed(2)} ms/iter`);

  // fetchstream selective (just the array elements)
  t0 = performance.now();
  for (let k = 0; k < ITER; k++) {
    const h = new StreamHandle();
    let count = 0;
    h.on('$.results.*', () => { count++; });
    h.feed(bytes);
    h.end();
    if (count !== N) throw new Error();
  }
  t1 = performance.now();
  console.log(`fetchstream $.results.*: ${((t1 - t0) / ITER).toFixed(2)} ms/iter`);

  // SAX events only (no value materialization beyond primitives)
  t0 = performance.now();
  for (let k = 0; k < ITER; k++) {
    let kc = 0;
    const p = new JSONStreamParser({
      onKey: () => kc++,
      onValue: () => kc++,
    });
    p.write(bytes);
    p.end();
  }
  t1 = performance.now();
  console.log(`fetchstream SAX only:    ${((t1 - t0) / ITER).toFixed(2)} ms/iter`);
}

// ----- 2) Streaming-source comparison (real win) -----
async function benchStreaming(N) {
  const json = makePayload(N);
  const bytes = enc.encode(json);
  const CHUNK = 16 * 1024;     // 16 KiB chunks
  const DELAY_MS = 4;          // simulate slow network: 4 ms between chunks
  const totalChunks = Math.ceil(bytes.length / CHUNK);
  const expectedTotalMs = totalChunks * DELAY_MS;

  console.log(`\n--- Streaming source (${N.toLocaleString()} items, ${(bytes.length / 1024).toFixed(1)} KiB, ${CHUNK / 1024} KiB chunks @ ${DELAY_MS} ms) ---`);
  console.log(`Total network time: ~${expectedTotalMs} ms (${totalChunks} chunks)`);

  // JSON.parse must wait for full body
  {
    const t0 = performance.now();
    let buffer = new Uint8Array(0);
    for (let i = 0; i < bytes.length; i += CHUNK) {
      await sleep(DELAY_MS);
      const part = bytes.subarray(i, Math.min(bytes.length, i + CHUNK));
      const merged = new Uint8Array(buffer.length + part.length);
      merged.set(buffer); merged.set(part, buffer.length);
      buffer = merged;
    }
    const text = new TextDecoder().decode(buffer);
    const obj = JSON.parse(text);
    const t1 = performance.now();
    console.log(`JSON.parse(after full download): first item available at ${(t1 - t0).toFixed(0)} ms (count=${obj.results.length})`);
  }

  // fetchstream emits each item as soon as its closing `}` arrives
  {
    const h = new StreamHandle();
    let firstAt = -1;
    let lastAt = -1;
    let count = 0;
    const t0 = performance.now();
    h.on('$.results.*', () => {
      if (firstAt < 0) firstAt = performance.now() - t0;
      lastAt = performance.now() - t0;
      count++;
    });
    for (let i = 0; i < bytes.length; i += CHUNK) {
      await sleep(DELAY_MS);
      h.feed(bytes.subarray(i, Math.min(bytes.length, i + CHUNK)));
    }
    h.end();
    console.log(`fetchstream $.results.*: first item at ${firstAt.toFixed(0)} ms, last at ${lastAt.toFixed(0)} ms (count=${count})`);
  }
}

function sleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

(async () => {
  benchWhole(1000);
  benchWhole(10000);
  benchWhole(50000);
  await benchStreaming(20000);
})().catch(e => { console.error(e); process.exit(1); });
