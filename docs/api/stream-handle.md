# StreamHandle

The handle returned by every entry point — `fetchStream(url)`, `streamJSON()`, and `streamFrom(source)`.

It is **chainable** (every subscription method returns `this`) and **awaitable** (it implements `then` / `catch` / `finally`).

```ts
class StreamHandle {
  on<T>(path: string, callback: (value: T, path: PathStack) => void): this;
  onProgress<T>(path: string, callback: (value: T, path: PathStack) => void, options?: ProgressOptions): this;
  live<T>(callback: (root: T) => void, options?: ProgressOptions): this;
  iterate<T>(path: string): AsyncIterable<T>;
  feed(bytes: Uint8Array): this;
  feedText(text: string): this;
  end(): this;
  readonly snapshot: unknown;
  readonly done: Promise<void>;
  then(...): Promise<...>;
  catch(...): Promise<...>;
  finally(...): Promise<void>;
}
```

## Subscription methods

### `.on(path, callback)`

Fires once per fully-formed match.

```js
handle.on("$.users.*", (user, path) => render(user));
```

Callbacks receive:

- `value` — the parsed value (matches `JSON.parse` semantics)
- `path` — frozen array of segments at the match point (e.g. `["users", 7]`)

See [Per-match callbacks](/guide/on-matches).

---

### `.onProgress(path, callback, options?)`

Fires on **every mutation** of the subtree at `path` — including its descendants. The callback receives a fresh `{ data, chunks, done, path }` wrapper each tick.

```js
handle.onProgress("$.products", ({ data: products, done }) => {
  render(products);
  if (done) console.log("products subtree complete");
});
```

`options.throttle` defaults to `'raf'` in browsers and to no throttle in Node/SSR. Pass `{ throttle: 50 }` for a fixed millisecond cadence or `{ throttle: false }` to disable.

Options:

- `throttle: "raf"` — coalesce updates to one per animation frame (default in browsers)
- `throttle: number` — coalesce to one per `<n>` ms
- `throttle: false` — disable throttling (default in Node/SSR)

The `data` field of the wrapper is a **live mutable reference** — the same object across all calls — that grows in place. The wrapper itself is fresh each tick, so it can be passed directly to React's `setState`.

---

### `.live(callback, options?)`

Sugar for `.onProgress("$", callback, options)`. Mirrors the entire document. The callback receives the same `{ data, chunks, done, path }` wrapper — safe to pass straight to React's `setState`.

```js
handle.live(({ data }) => render(data));
// or in React:  handle.live(setSnap);
```

See [Live mirror mode](/guide/live-mode).

---

### `.iterate(path)`

Returns an `AsyncIterable` — pull matches with backpressure.

```js
for await (const item of handle.iterate("$.items.*")) {
  await render(item); // parser pauses here
}
```

See [Async iteration](/guide/iteration).

## Feeding methods

### `.feed(bytes)`

Push a `Uint8Array` chunk into the parser.

```js
handle.feed(new Uint8Array([0x7b, 0x7d])); // {}
```

### `.feedText(text)`

Convenience: UTF-8 encode and feed.

```js
handle.feedText('{"hello":"world"}');
```

### `.end()`

Signal that no more bytes are coming. Causes the handle's `done` promise to resolve once any pending parser state is drained.

```js
handle.end();
await handle;
```

## Reading state

### `.snapshot`

A getter that returns the current root of the live mirror, even outside the `.live` callback:

```js
const stream = fetchStream(url).live(() => {});
// reading via stream.snapshot returns the inner mutating tree directly
// (equivalent to wrapper.data inside the callback)

setInterval(() => {
  console.log("current root:", stream.snapshot);
}, 100);

await stream;
console.log("final root:", stream.snapshot);
```

### `.done`

The underlying promise. Resolves when the stream finishes successfully, rejects on error or abort:

```js
handle.done.then(() => console.log("clean")).catch(console.error);
```

You usually `await handle` directly instead of `await handle.done`.

## Awaiting

`StreamHandle` is a thenable, so all of these work:

```js
await handle;
await handle.done;
handle.then(onFulfilled, onRejected);
handle.catch(onRejected);
handle.finally(onFinally);
```

## Errors

The handle rejects on:

- HTTP errors (when used via `fetchStream`)
- Parser errors (malformed JSON)
- Errors thrown synchronously from a subscription callback
- `AbortSignal` abortion

The body reader is canceled on rejection.
