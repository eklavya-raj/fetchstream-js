# Manual feeding

Sometimes you have bytes from a non-fetch source (WebSocket, MessageChannel, file picker, decoded WebRTC channel, …) and want to use the parser directly.

`streamJSON()` returns a fresh `StreamHandle` you can feed manually:

```js
import { streamJSON } from "fetchstream";

const stream = streamJSON();

stream.on("$.users.*", (user) => console.log(user));

stream.feed(uint8ArrayChunk1);
stream.feed(uint8ArrayChunk2);
stream.end();

await stream;
```

## API

| Method | Description |
| ------ | ----------- |
| `.feed(uint8Array)` | Push a chunk of bytes |
| `.feedText(string)` | UTF-8 encode and push (convenience) |
| `.end()` | Signal that no more bytes are coming |
| `.then` / `.catch` | Awaitable; resolves when `.end()` is processed |

All chunks **must** be valid UTF-8 byte slices of the original document. Multi-byte characters can be split across chunks — the parser stitches them.

## Use case: WebSocket

```js
const ws = new WebSocket("wss://example.com/stream");
const stream = streamJSON();

stream.on("$.events.*", (event) => render(event));

ws.binaryType = "arraybuffer";
ws.addEventListener("message", (e) => {
  if (e.data instanceof ArrayBuffer) {
    stream.feed(new Uint8Array(e.data));
  } else {
    stream.feedText(e.data);
  }
});
ws.addEventListener("close", () => stream.end());

await stream;
```

## Use case: File picker

Browser-side parsing of a user-uploaded JSON file, **without** loading it all into memory:

```js
async function handleFile(file) {
  const stream = streamJSON();
  stream.on("$.records.*", (rec) => insert(rec));

  const reader = file.stream().getReader();
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    stream.feed(value);
  }
  stream.end();
  await stream;
}
```

Works on multi-GB files in modern browsers.

## Use case: Test fixtures

`streamJSON()` is also handy in unit tests for reproducible feeds:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { streamJSON } from "fetchstream";

test("emits each user", async () => {
  const got = [];
  const s = streamJSON().on("$.users.*", (u) => got.push(u));
  s.feedText('{"users":[{"id":1},');
  s.feedText('{"id":2}]}');
  s.end();
  await s;
  assert.deepEqual(got, [{ id: 1 }, { id: 2 }]);
});
```

You can split the input at any byte boundary — including in the middle of a multi-byte character — and the parser will produce the exact same output.

## Pre-feeding before subscribing

Subscriptions registered after bytes are already fed will miss earlier matches. Always register `.on()` / `.live()` **before** the first `.feed()`:

```js
const stream = streamJSON();

// ✅ subscribe first
stream.on("$.items.*", handle);

// then feed
stream.feed(chunk);
```

The same rule applies to `fetchStream(url)` — subscriptions chained synchronously after the call are honored, but the actual fetch starts on the next microtask.
