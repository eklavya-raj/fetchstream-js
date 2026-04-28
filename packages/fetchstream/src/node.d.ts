// Type definitions for `fetchstream/node`
//
// Adds `streamFrom(source)` for Node Readable streams, Web ReadableStream,
// and any async iterable producing Uint8Array / Buffer / string.

import { StreamHandle } from './index';

export * from './index';

/**
 * Feed a Web `ReadableStream`, Node `Readable`, or any async iterable of
 * `Uint8Array` / `Buffer` / `string` into a fresh `StreamHandle`.
 *
 * @example
 * import { streamFrom } from 'fetchstream/node';
 * import { createReadStream } from 'node:fs';
 *
 * await streamFrom(createReadStream('huge.json'))
 *   .on('$.records.*', record => process(record));
 */
export function streamFrom(
  source:
    | ReadableStream<Uint8Array>
    | AsyncIterable<Uint8Array | string | { buffer: ArrayBufferLike; byteOffset: number; byteLength: number }>
    | NodeJS.ReadableStream
): StreamHandle;
