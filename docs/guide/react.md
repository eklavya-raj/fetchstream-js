# React integration

`fetchstream` works in React with **zero special tooling**. The library's built-in `requestAnimationFrame` throttling means you don't need a custom `useRafState` hook or `useTransition` — just a plain `useState` plus a tick.

## Minimal example

```jsx
import { useEffect, useState } from "react";
import { fetchStream } from "fetchstream";

export default function ProductList() {
  const [products, setProducts] = useState([]);

  useEffect(() => {
    const ac = new AbortController();
    fetchStream("/api/products", { signal: ac.signal }).live(
      (root) => setProducts([...(root.products ?? [])]),
      { throttle: "raf" },
    );
    return () => ac.abort();
  }, []);

  return (
    <ul>
      {products.map((p) => <li key={p.id}>{p.name}</li>)}
    </ul>
  );
}
```

The product list grows on screen as bytes arrive, smoothly throttled to 60 fps.

## Avoid array-copy on every frame

Spreading `[...root.products]` on every callback creates a new array each frame. For 10k+ items you'll want a more efficient pattern:

```jsx
import { useEffect, useReducer, useRef } from "react";
import { fetchStream } from "fetchstream";

export default function ProductList() {
  const dataRef = useRef([]);
  const [, tick] = useReducer((x) => x + 1, 0);

  useEffect(() => {
    const ac = new AbortController();
    fetchStream("/api/products", { signal: ac.signal }).live(
      (root) => {
        dataRef.current = root.products ?? [];
        tick();
      },
      { throttle: "raf" },
    );
    return () => ac.abort();
  }, []);

  return (
    <ul>
      {dataRef.current.map((p) => <li key={p.id}>{p.name}</li>)}
    </ul>
  );
}
```

The parser mutates the array **in place** — `dataRef.current` always points to the latest version. `tick()` triggers a re-render once per frame.

## Custom hook

Wrap the pattern in a reusable hook:

```ts
// hooks/useFetchStream.ts
"use client";
import { useEffect, useReducer, useRef } from "react";
import { fetchStream } from "fetchstream";

export function useFetchStream<T = unknown>(url: string | null) {
  const dataRef = useRef<T | undefined>(undefined);
  const [, tick] = useReducer((x: number) => x + 1, 0);

  useEffect(() => {
    if (!url) return;
    const ac = new AbortController();
    fetchStream(url, { signal: ac.signal }).live<T>(
      (root) => {
        dataRef.current = root;
        tick();
      },
      { throttle: "raf" },
    );
    return () => ac.abort();
  }, [url]);

  return dataRef.current;
}
```

```jsx
function App() {
  const data = useFetchStream("/api/data");
  return <pre>{JSON.stringify(data, null, 2)}</pre>;
}
```

## Per-match (non-live) pattern

If you'd rather append items as they arrive (no full-tree mirror), use `.on()`:

```jsx
import { useEffect, useReducer, useRef } from "react";
import { fetchStream } from "fetchstream";

function ProductFeed() {
  const items = useRef([]);
  const [, tick] = useReducer((x) => x + 1, 0);

  useEffect(() => {
    const ac = new AbortController();
    let frame = 0;
    fetchStream("/api/products", { signal: ac.signal })
      .on("$.products.*", (p) => {
        items.current.push(p);
        // batch with rAF manually since .on() has no throttle option
        if (!frame) frame = requestAnimationFrame(() => {
          frame = 0;
          tick();
        });
      });
    return () => ac.abort();
  }, []);

  return items.current.map((p) => <Card key={p.id} {...p} />);
}
```

For most React apps, `.live()` with `throttle: "raf"` is simpler — let the library do the throttling.

## Production-grade demo

The repo ships with a full Next.js + React 19 example that benchmarks `fetch + JSON.parse` against `fetchStream` side-by-side, with live metrics, abort controls, and rAF-throttled card rendering.

See [React benchmark demo](/examples/react) for a code walkthrough.

## Server Components

Streaming JSON inside an RSC-rendered page works too — call `fetchStream` in a Server Component and `await` the handle:

```jsx
// app/products/page.tsx
import { fetchStream } from "fetchstream";

export default async function Page() {
  const items: Product[] = [];
  await fetchStream("https://api.example.com/products")
    .on("$.products.*", (p) => items.push(p));

  return <ProductList products={items} />;
}
```

Note: in RSC you don't get incremental rendering — the page only commits after `await` resolves. Streaming pays off most in **Client Components** where the user can see partial state.
