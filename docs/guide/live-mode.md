# Live mirror mode

If you want the **whole document** available to your UI as it streams in — perfect for React, Vue, Svelte, Solid, etc. — use `.live(callback)` instead of per-match callbacks.

```js
fetchStream(url).live((root) => render(root), { throttle: "raf" });
```

## How it works

The library maintains **one** mutable `root` object that grows in place as bytes arrive. On every parser mutation, your callback fires with the same `root` reference, just slightly more populated.

The shape of `root` mid-stream **always** matches the shape of your final document, just with fewer keys/elements.

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

What `root` looks like over time:

```js
fetchStream(url).live((root) => {
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

What `root` looks like over time:

```js
fetchStream(url).live((root) => {
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

What `root` looks like over time:

```js
fetchStream(url).live((root) => {
  // { students: [{ name: "Alex" }] }
  // { students: [{ name: "Alex" }, { name: "Sam" }] }
  // { students: [...], teachers: [{ name: "David" }] }
  // { students: [...], teachers: [...], admins: [{ name: "Mike" }] }
});
```

## Throttling

For very fast streams, every byte boundary can produce a parser mutation — that's far more often than a UI needs to re-render.

### `throttle: "raf"` (recommended for browsers)

```js
fetchStream(url).live((root) => render(root), { throttle: "raf" });
```

Coalesces updates onto `requestAnimationFrame`. Your callback fires **at most once per animation frame** (~60 fps). The very last update is always flushed synchronously when the stream ends, so the consumer always sees the final state before `done` resolves.

In Node/SSR there's no `requestAnimationFrame`, so the library falls back to a ~16 ms `setTimeout`.

### `throttle: <number>` (millisecond budget)

```js
fetchStream(url).live((root) => render(root), { throttle: 50 });
```

Throttle to a specific cadence (e.g. 20 fps). Useful when you want a slower update rate than vsync.

### No throttle

```js
fetchStream(url).live((root) => render(root));
```

Fires on every parser mutation — useful for benchmarks, tests, or non-UI consumers.

## Subtree progress

Use `.onProgress(path, cb)` to mirror **just one subtree** of the document:

```js
fetchStream(url).onProgress(
  "$.products",
  (products, path) => render(products),
  {
    throttle: "raf",
  },
);
```

The callback fires every time the products subtree mutates — but not when sibling keys are added.

`.live(cb)` is sugar for `.onProgress("$", cb)`.

## React example

```jsx
import { useEffect, useState } from "react";
import { fetchStream } from "fetchstream-js";

function App() {
  const [snap, setSnap] = useState({ root: undefined });

  useEffect(() => {
    const ac = new AbortController();
    fetchStream("/api/data", { signal: ac.signal }).live(
      (root) => setSnap({ root }),
      { throttle: "raf" },
    );
    return () => ac.abort();
  }, []);

  return <pre>{JSON.stringify(snap.root, null, 2)}</pre>;
}
```

No `useRef`, no `useReducer`, no manual `requestAnimationFrame` — the library does the throttling for you.

See [React integration](/guide/react) for a full production-grade example.

## Snapshot getter

Need to read the live root from outside the callback?

```js
const stream = fetchStream(url).live((root) => render(root));

// later, even after `await stream`:
const current = stream.snapshot;
```

`stream.snapshot` is a getter that always returns the latest version of the live root.
