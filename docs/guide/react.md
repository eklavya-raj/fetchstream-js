# React quick start

`fetchstream-js` is designed to **replace `fetch` / `axios` in React** wherever you load a non-trivial JSON response. Swap one line and your UI starts rendering rows while the response is still downloading, instead of blocking on `await res.json()`.

## Before / after

```tsx
// ❌ Before — fetch: blocks until the full body arrives
useEffect(() => {
  fetch("/api/products")
    .then((r) => r.json())
    .then(setProducts);
}, []);
```

```tsx
// ❌ Before — axios: same problem
useEffect(() => {
  axios.get("/api/products").then((res) => setProducts(res.data));
}, []);
```

```tsx
// ✅ After — fetchstream-js: state grows as bytes arrive
useEffect(() => {
  const ac = new AbortController();
  fetchStream("/api/products", { signal: ac.signal }).live(setSnap);
  return () => ac.abort();
}, []);
```

Same endpoint. Same response. First row paints **~25× sooner**.

## Why this is painless in React

The `.live()` callback receives a **fresh `{ data, chunks, done, path }` wrapper** each delivery, so passing it straight to `setState` re-renders without spread, `useRef`, `useReducer`, `useTransition`, `useDeferredValue`, or a custom `useRafState`. The library also defaults to `requestAnimationFrame` throttling in browsers, so you get one render per frame for free.

## Minimal example

```jsx
import { useEffect, useState } from "react";
import { fetchStream } from "fetchstream-js";

export default function ProductList() {
  const [snap, setSnap] = useState({ data: null, chunks: 0, done: false });

  useEffect(() => {
    const ac = new AbortController();
    fetchStream("/api/products", { signal: ac.signal }).live(setSnap);
    return () => ac.abort();
  }, []);

  const products = snap.data?.products ?? [];
  return (
    <ul>
      {products.map((p) => (
        <li key={p.id}>{p.name}</li>
      ))}
    </ul>
  );
}
```

The product list grows on screen as bytes arrive, smoothly throttled to 60 fps. **No spread, no `useRef`, no `useReducer`** — the wrapper itself changes reference each tick, which is what React needs to re-render. `snap.data` is the same in-place-mutating array, so reads stay zero-copy.

## Custom hook

Wrap the pattern in a reusable hook:

```ts
// hooks/useFetchStream.ts
"use client";
import { useEffect, useState } from "react";
import { fetchStream, type LiveSnapshot } from "fetchstream-js";

const INITIAL = { data: undefined, chunks: 0, done: false, path: [] };

export function useFetchStream<T = unknown>(url: string | null) {
  const [snap, setSnap] = useState<LiveSnapshot<T | undefined>>(INITIAL);

  useEffect(() => {
    if (!url) return;
    setSnap(INITIAL);
    const ac = new AbortController();
    fetchStream(url, { signal: ac.signal }).live<T>(setSnap);
    return () => ac.abort();
  }, [url]);

  return snap;
}
```

```jsx
function App() {
  const { data, chunks, done } = useFetchStream("/api/data");
  return (
    <>
      <pre>{JSON.stringify(data, null, 2)}</pre>
      <small>{done ? "complete" : `streaming (${chunks} updates)`}</small>
    </>
  );
}
```

## Per-match (non-live) pattern

If you'd rather append items as they arrive (no full-tree mirror), use `.on()`:

```jsx
import { useEffect, useReducer, useRef } from "react";
import { fetchStream } from "fetchstream-js";

function ProductFeed() {
  const items = useRef([]);
  const [, tick] = useReducer((x) => x + 1, 0);

  useEffect(() => {
    const ac = new AbortController();
    let frame = 0;
    fetchStream("/api/products", { signal: ac.signal }).on(
      "$.products.*",
      (p) => {
        items.current.push(p);
        // batch with rAF manually since .on() has no throttle option
        if (!frame)
          frame = requestAnimationFrame(() => {
            frame = 0;
            tick();
          });
      },
    );
    return () => ac.abort();
  }, []);

  return items.current.map((p) => <Card key={p.id} {...p} />);
}
```

For most React apps, `.live(setSnap)` is simpler — let the library do the throttling and the re-render plumbing.

## Production-grade demo

The repo ships with a full Next.js + React 19 example that benchmarks `fetch + JSON.parse` against `fetchStream` side-by-side, with live metrics, abort controls, and rAF-throttled card rendering.

See [React benchmark demo](/examples/react) for a code walkthrough.

## Server Components

Streaming JSON inside an RSC-rendered page works too — call `fetchStream` in a Server Component and `await` the handle:

```jsx
// app/products/page.tsx
import { fetchStream } from "fetchstream-js";

export default async function Page() {
  const items: Product[] = [];
  await fetchStream("https://api.example.com/products")
    .on("$.products.*", (p) => items.push(p));

  return <ProductList products={items} />;
}
```

Note: in RSC you don't get incremental rendering — the page only commits after `await` resolves. Streaming pays off most in **Client Components** where the user can see partial state.
