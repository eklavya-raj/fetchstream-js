# Node.js

`fetchstream` works in Node 18+ out of the box (uses native `fetch` + `TextDecoder`). For Node-specific stream sources, use the `fetchstream/node` subpath.

## Pipe a `Readable`

```js
import { streamFrom } from "fetchstream/node";
import { createReadStream } from "node:fs";

await streamFrom(createReadStream("huge.json"))
  .on("$.records.*", (record) => process(record));
```

`streamFrom` accepts:

- A Node `Readable`
- A WHATWG `ReadableStream`
- Any async iterable yielding `Uint8Array`, `Buffer`, or `string`

## ETL pipeline

```js
import { streamFrom } from "fetchstream/node";
import { createReadStream } from "node:fs";

const file = createReadStream("./exports/orders.json");

for await (const order of streamFrom(file).iterate("$.orders.*")) {
  await db.orders.insert(order);
}
```

Constant-memory ingestion of arbitrarily large JSON files.

## HTTP responses

In Node, `fetchStream(url)` works the same as in the browser — wrapping `fetch()`:

```js
import { fetchStream } from "fetchstream";

await fetchStream("https://api.example.com/data")
  .on("$.items.*", (item) => process(item));
```

## Express middleware

Stream a parsed body into a handler:

```js
import express from "express";
import { streamFrom } from "fetchstream/node";

const app = express();

app.post("/upload", async (req, res) => {
  let count = 0;
  await streamFrom(req).on("$.events.*", (event) => {
    count++;
    queue.push(event);
  });
  res.json({ ingested: count });
});
```

The request body is parsed as it arrives — no `body-parser`, no `JSON.parse` of the full payload.

## Worker threads

Decode JSON in a worker without blocking the main thread:

```js
import { Worker } from "node:worker_threads";

const worker = new Worker("./parser-worker.js");
worker.postMessage({ url: "https://api.example.com/big.json" });
worker.on("message", (item) => handle(item));
```

```js
// parser-worker.js
import { parentPort } from "node:worker_threads";
import { fetchStream } from "fetchstream";

parentPort.on("message", async ({ url }) => {
  await fetchStream(url).on("$.items.*", (item) => {
    parentPort.postMessage(item);
  });
});
```

## CLI tool

Build a `jq`-style CLI:

```js
#!/usr/bin/env node
import { streamFrom } from "fetchstream/node";

const path = process.argv[2] || "$.*";
await streamFrom(process.stdin).on(path, (val) => {
  process.stdout.write(JSON.stringify(val) + "\n");
});
```

```bash
$ curl https://example.com/data.json | mytool '$.users.*'
```

## Memory characteristics

`fetchstream` keeps roughly:

- One `Uint8Array` per active in-flight string/number/keyword (typically a few hundred bytes)
- Whatever JS objects you've materialized via subscriptions

A 10 GB JSON file with `$.records.*` and a `process()` that doesn't retain references uses **kilobytes**, not gigabytes.
