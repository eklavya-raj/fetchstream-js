# Per-match callbacks

The `.on(path, callback)` API fires your handler **once per fully-formed match**, with the parsed value as the first argument and the path stack as the second.

```js
fetchStream("/api/users")
  .on("$.users.*", (user, path) => {
    // user: { id: 1, name: "Alex", ... }
    // path: ["users", 0]
  });
```

## When does a callback fire?

The moment the parser sees the closing token of the matched value:

| Match type | Fires when |
| ---------- | ---------- |
| object     | `}` arrives |
| array      | `]` arrives |
| string     | closing `"` arrives |
| number     | first non-numeric byte after the last digit |
| literal    | last byte of `true` / `false` / `null` |

So if you subscribe to `$.users.*` against:

```json
{ "users": [{ "id": 1 }, { "id": 2 }] }
```

...your callback fires twice — once at the `}` after `id: 1`, and again at the `}` after `id: 2`.

## What you receive

The callback receives the **fully materialized JS value** — exactly what `JSON.parse` would have given you for that subtree:

```js
fetchStream(url).on("$.users.*", (user) => {
  user.name;       // string
  user.tags;       // array
  user.address;    // object
  user.active;     // boolean
});
```

Strings, numbers, booleans, null, objects, and arrays are all hydrated normally. Nested matches inside a parent match still work too:

```js
fetchStream(url)
  .on("$.users.*", (user) => { /* fires once per user */ })
  .on("$.users.*.email", (email) => { /* fires once per user, slightly earlier */ });
```

## Multiple subscriptions, single parse

Register as many handlers as you want — they're all evaluated against a single byte-stream pass:

```js
fetchStream(url)
  .on("$.meta", (meta) => setMeta(meta))         // 1×
  .on("$.totalCount", (n) => setCount(n))        // 1×
  .on("$.products.*", (p) => addProduct(p))      // N×
  .on("$.products.*.price", (p) => trackPrice(p)) // N× (nested under products.*)
  .on("$.errors.*", (e) => logError(e));         // 0..N×
```

The picker layer only allocates objects for paths that have at least one subscription. Sibling subtrees pass through the parser untouched.

## Path argument

The second argument is an immutable snapshot of the path stack at the time of the match:

```js
fetchStream(url).on("$.users.*", (user, path) => {
  // path is a frozen array, e.g. ["users", 7]
  console.log("Got user at index", path[1]);
});
```

Useful when you need to know *which* index/key matched a wildcard.

## Async callbacks

Per-match callbacks are fire-and-forget — the parser does **not** await them:

```js
fetchStream(url).on("$.users.*", async (user) => {
  await saveToDatabase(user); // ❌ parser keeps going regardless
});
```

If you need backpressure (parser pauses until your handler finishes), use `.iterate()` instead:

```js
for await (const user of fetchStream(url).iterate("$.users.*")) {
  await saveToDatabase(user); // ✅ parser blocks until done
}
```

See [Async iteration](/guide/iteration).

## Errors in callbacks

Throwing from a callback rejects the handle:

```js
try {
  await fetchStream(url).on("$.users.*", (user) => {
    if (!user.id) throw new Error("Bad user");
  });
} catch (err) {
  // err is the thrown error
}
```

The body reader is canceled when this happens — no more bytes are pulled.
