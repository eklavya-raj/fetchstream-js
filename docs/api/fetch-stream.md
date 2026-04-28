# fetchStream()

```ts
function fetchStream(
  resource: string | URL | Request,
  options?: RequestInit,
): StreamHandle;
```

Streams JSON from a URL. Mirrors the WHATWG `fetch()` signature **exactly** — every option `fetch` accepts (`method`, `headers`, `body`, `mode`, `credentials`, `cache`, `redirect`, `referrer`, `referrerPolicy`, `integrity`, `keepalive`, `signal`, `priority`, …) is forwarded.

## Basic usage

```js
import { fetchStream } from "fetchstream";

await fetchStream("/api/products")
  .on("$.products.*", (p) => render(p))
  .on("$.totalCount", (n) => setCount(n));
```

## With request init

```js
fetchStream("/api/products", {
  method: "POST",
  headers: { "content-type": "application/json", authorization: "Bearer …" },
  body: JSON.stringify({ filter: { active: true } }),
});
```

## Aborting

```js
const ac = new AbortController();
const stream = fetchStream("/api/products", { signal: ac.signal });

stream.on("$.products.*", render);

setTimeout(() => ac.abort(), 5000);

try {
  await stream;
} catch (err) {
  if (err.name === "AbortError") {
    console.log("user canceled");
  }
}
```

Aborting:

- Cancels the body reader (no further bytes pulled)
- Rejects the handle's `done` promise with the `AbortError`
- Stops further callbacks from firing

## Error handling

| Error | When |
| ----- | ---- |
| `Error("HTTP 404 …")` | Server responded with non-2xx |
| Parser error | Malformed JSON in the response body |
| `AbortError` | `options.signal` was aborted |
| `TypeError` | Network failure (CORS, DNS, etc.) |

```js
try {
  await fetchStream(url).on("$.items.*", render);
} catch (err) {
  if (err.status === 404) showNotFound();
  else if (err.name === "AbortError") /* ... */;
  else throw err;
}
```

For HTTP errors, the thrown error has additional properties:

```ts
err.status   // number — HTTP status code
err.response // Response — the original Response object (already drained)
```

## Subscriptions before fetch

The actual fetch is deferred to the next microtask, so synchronous chaining works:

```js
fetchStream(url)
  .on("$.a", a)
  .on("$.b", b)
  .on("$.c", c);
// fetch starts here, with all 3 subscriptions registered
```

Subscriptions registered **asynchronously** (after a `setTimeout` / `await`) may miss earlier matches.

## Returns

A [`StreamHandle`](/api/stream-handle) — chainable (`.on`, `.onProgress`, `.live`, `.iterate`) and awaitable (`then`/`catch`/`finally`).
