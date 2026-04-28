# Live mirror mode

If you want the **whole document** available to your UI as it streams in — perfect for React, Vue, Svelte, Solid, etc. — use `.live(callback)` instead of per-match callbacks.

```js
fetchStream(url).live(({ data }) => render(data));
```

## Callback shape

The callback receives a fresh wrapper each delivery:

```ts
{
  data:   T,        // the live mutating tree (same reference each tick)
  chunks: number,   // per-subscription delivery counter (1, 2, 3, ...)
  done:   boolean,  // true on the final delivery for this subscription
  path:   PathStack // where the subscription matched
}
```

## How it works

The library maintains **one** mutable `data` object that grows in place as bytes arrive. On every parser mutation, your callback fires with that same `data` reference, just slightly more populated, wrapped in a fresh outer object so frameworks like React re-render naturally.

The shape of `data` mid-stream **always** matches the shape of your final document, just with fewer keys/elements.

## Examples

### Root with keyed entries

Streamed JSON:

```json
{
  "user1": { "name": "Alex", "age": 22 },
  "user2": { "name": "Sam", "age": 25 },
  "user3": { "name": "John", "age": 28 }
}
```

What `data` looks like over time:

```js
fetchStream(url).live(({ data }) => {
  // 1st commit: { user1: { name: "Alex", age: 22 } }
  // 2nd commit: { user1: {...}, user2: { name: "Sam", age: 25 } }
  // 3rd commit: { user1: {...}, user2: {...}, user3: { name: "John", age: 28 } }
});
```

### Root array

Streamed JSON:

```json
[
  { "name": "Alex", "age": 22 },
  { "name": "Sam", "age": 25 }
]
```

What `data` looks like over time:

```js
fetchStream(url).live(({ data }) => {
  // 1st: [{ name: "Alex", age: 22 }]
  // 2nd: [{ name: "Alex", age: 22 }, { name: "Sam", age: 25 }]
});
```

### Nested arrays

Streamed JSON:

```json
{
  "students": [{ "name": "Alex" }, { "name": "Sam" }],
  "teachers": [{ "name": "David" }],
  "admins": [{ "name": "Mike" }]
}
```

What `data` looks like over time:

```js
fetchStream(url).live(({ data }) => {
  // { students: [{ name: "Alex" }] }
  // { students: [{ name: "Alex" }, { name: "Sam" }] }
  // { students: [...], teachers: [{ name: "David" }] }
  // { students: [...], teachers: [...], admins: [{ name: "Mike" }] }
});
```

## Throttling

For very fast streams, every byte boundary can produce a parser mutation — that's far more often than a UI needs to re-render.

### `throttle: "raf"` (default in browsers)

```js
fetchStream(url).live(({ data }) => render(data));
// equivalent to: .live(cb, { throttle: "raf" })
```

Coalesces updates onto `requestAnimationFrame`. Your callback fires **at most once per animation frame** (~60 fps). The very last update is always flushed synchronously when the stream ends, so the consumer always sees the final state (with `done: true`) before the handle resolves.

In Node/SSR there's no `requestAnimationFrame`, so the default is **no throttle** — every parser mutation produces a delivery, which is what server-side consumers typically want.

### `throttle: <number>` (millisecond budget)

```js
fetchStream(url).live(({ data }) => render(data), { throttle: 50 });
```

Throttle to a specific cadence (e.g. 20 fps). Useful when you want a slower update rate than vsync.

### Disable throttling

```js
fetchStream(url).live(({ data }) => render(data), { throttle: false });
```

Fires on every parser mutation — useful for benchmarks, tests, or non-UI consumers in a browser environment.

## Subtree progress

Use `.onProgress(path, cb)` to mirror **just one subtree** of the document:

```js
fetchStream(url).onProgress("$.products", ({ data: products }) =>
  render(products),
);
```

The callback fires every time the products subtree mutates — but not when sibling keys are added. The wrapper's `done` flips to `true` once the products subtree closes, even if the rest of the document is still streaming.

`.live(cb)` is sugar for `.onProgress("$", cb)`.

## React example

```jsx
import { useEffect, useState } from "react";
import { fetchStream } from "fetchstream-js";

function App() {
  const [snap, setSnap] = useState({ data: undefined, chunks: 0, done: false });

  useEffect(() => {
    const ac = new AbortController();
    fetchStream("/api/data", { signal: ac.signal }).live(setSnap);
    return () => ac.abort();
  }, []);

  return <pre>{JSON.stringify(snap.data, null, 2)}</pre>;
}
```

No spread, no `useRef`, no `useReducer`, no manual `requestAnimationFrame` — the wrapper changes reference each tick (so React re-renders) and the library does the throttling for you.

See [React integration](/guide/react) for a full production-grade example.

## Snapshot getter

Need to read the live root from outside the callback?

```js
const stream = fetchStream(url).live(({ data }) => render(data));

// later, even after `await stream`:
const current = stream.snapshot;
```

`stream.snapshot` is a getter that always returns the latest version of the live root — it's the same reference as the `data` field of the wrapper passed to your callback.
