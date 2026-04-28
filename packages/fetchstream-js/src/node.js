// fetchstream-js/src/node.js
// Node-friendly adapter. Works with anything that implements the async iterator
// protocol (e.g. node:stream Readable, node:http IncomingMessage, fs.createReadStream).
//
// In Node 18+, the universal `fetchStream` from ./index.js also works because
// global fetch returns Web ReadableStream bodies.

import { StreamHandle } from './index.js';
export * from './index.js';

// Feed a node Readable / async iterable / Web ReadableStream into a StreamHandle.
// Returns the StreamHandle. Subscriptions chained synchronously are honored.
export function streamFrom(source) {
  const handle = new StreamHandle();
  Promise.resolve().then(() => handle._begin(() => pump(source, handle)));
  return handle;
}

async function pump(source, handle) {
  // Web ReadableStream
  if (source && typeof source.getReader === 'function') {
    const reader = source.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      handle.feed(toUint8(value));
    }
    handle.end();
    return;
  }

  // async iterable / Node Readable (which is iterable)
  if (source && typeof source[Symbol.asyncIterator] === 'function') {
    for await (const chunk of source) {
      handle.feed(toUint8(chunk));
    }
    handle.end();
    return;
  }

  throw new Error('Unsupported source — expected ReadableStream or async iterable.');
}

function toUint8(chunk) {
  if (chunk instanceof Uint8Array) return chunk;
  if (typeof chunk === 'string') return new TextEncoder().encode(chunk);
  if (chunk && chunk.buffer instanceof ArrayBuffer) {
    return new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  }
  if (chunk && typeof Buffer !== 'undefined' && Buffer.isBuffer(chunk)) {
    return new Uint8Array(chunk.buffer, chunk.byteOffset, chunk.byteLength);
  }
  throw new TypeError('Unsupported chunk type: ' + Object.prototype.toString.call(chunk));
}
