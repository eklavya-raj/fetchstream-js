# streamJSON()

```ts
function streamJSON(): StreamHandle;
```

Returns a fresh `StreamHandle` **without** initiating a fetch. You feed bytes manually with `.feed()` / `.feedText()` and finalize with `.end()`.

## Usage

```js
import { streamJSON } from "fetchstream";

const stream = streamJSON();

stream.on("$.users.*", (user) => console.log(user));

stream.feed(uint8ArrayChunk1);
stream.feed(uint8ArrayChunk2);
stream.end();

await stream;
```

## When to use

- Bytes come from a non-fetch source: WebSocket, MessageChannel, file picker, decoded WebRTC channel
- You already have a `Response` and want full control over the reader loop
- You're writing tests / fixtures that need deterministic chunk boundaries

For HTTP responses, prefer [`fetchStream`](/api/fetch-stream) — it handles the body reader for you.

For Node `Readable`s or arbitrary async iterables, prefer [`streamFrom`](/guide/node) from `fetchstream/node`.

## Methods (added by `StreamHandle`)

| Method | Description |
| ------ | ----------- |
| `.feed(bytes)` | Push a `Uint8Array` chunk |
| `.feedText(string)` | UTF-8 encode and push a string |
| `.end()` | Signal that no more bytes are coming |

Multi-byte UTF-8 characters can be split across chunks — the parser stitches them. Don't worry about chunk boundaries.

## Subscriptions before feeding

```js
const s = streamJSON();
s.on("$.items.*", handle); // ✅ register first
s.feed(chunk);             // then feed
```

Subscriptions registered after bytes are already fed will miss earlier matches.

## See also

- [Manual feeding guide](/guide/manual-feeding) — full walkthroughs
- [`StreamHandle`](/api/stream-handle) — methods inherited
