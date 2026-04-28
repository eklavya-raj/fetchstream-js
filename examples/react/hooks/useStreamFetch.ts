"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { streamFrom } from "fetchstream-js/node";
import { initialMetrics, type Item, type Metrics } from "../app/types";

/**
 * Streaming pattern using the headline `fetchStream` / `streamFrom` API.
 *
 *   handle.live<Item[]>((snap) => setSnap(snap))
 *
 * `snap` is a fresh `{ data, chunks, done, path }` wrapper each tick:
 *   - `snap.data`   : the in-place-mutating array (same reference each tick)
 *   - `snap.chunks` : delivery counter (drives natural re-renders)
 *   - `snap.done`   : true on the final delivery
 *
 * No useReducer, no manual rAF. The library defaults to `throttle: 'raf'` in
 * browsers; the wrapper changes ref each tick so React re-renders on its own.
 */
export function useStreamFetch() {
  const [metrics, setMetrics] = useState<Metrics>(initialMetrics);
  // Track the live wrapper directly. setSnap(wrapper) re-renders because the
  // wrapper is a NEW reference each tick (even though wrapper.data is stable).
  const [snap, setSnap] = useState<{ data: Item[]; chunks: number; done: boolean }>({
    data: [],
    chunks: 0,
    done: false,
  });

  console.log("snap", snap);
  const dataRef = useRef<Item[]>([]);
  dataRef.current = snap.data;

  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setSnap({ data: [], chunks: 0, done: false });
    setMetrics(initialMetrics);
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const run = useCallback(async (url: string) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setSnap({ data: [], chunks: 0, done: false });
    setMetrics({ ...initialMetrics, status: "running" });

    const t0 = performance.now();
    let firstItemSeen = false;

    const res = await fetch(url, { signal: ac.signal, cache: "no-store" });
    const ttfbMs = performance.now() - t0;
    const cl = Number(res.headers.get("content-length"));
    const bytes =
      Number.isFinite(cl) && cl > 0
        ? cl
        : new TextEncoder().encode(JSON.stringify(res.body)).byteLength;

    const handle = streamFrom(res.body!);

    handle.live<Item[]>((wrapper) => {
      // Pass the wrapper straight to setState. New ref => React re-renders.
      // wrapper.data is stable, so existing children that closed over old
      // wrappers' data still see live values.
      setSnap(wrapper);
      const len = Array.isArray(wrapper.data) ? wrapper.data.length : 0;
      if (!firstItemSeen && len > 0) {
        firstItemSeen = true;
        const ttfiMs = performance.now() - t0;
        setMetrics((m) => ({ ...m, ttfiMs, itemsRendered: len }));
      } else {
        setMetrics((m) =>
          m.itemsRendered === len ? m : { ...m, itemsRendered: len },
        );
      }
    });

    try {
      await handle;
      setMetrics((m) => ({
        ...m,
        status: "done",
        bytes,
        ttfbMs,
        totalMs: performance.now() - t0,
        itemsRendered: dataRef.current.length,
      }));
    } catch (e) {
      if (ac.signal.aborted) {
        setMetrics((m) => ({ ...m, status: "aborted" }));
        return;
      }
      setMetrics((m) => ({
        ...m,
        status: "error",
        errorMessage: e instanceof Error ? e.message : String(e),
      }));
    }
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  return { metrics, dataRef, run, abort, reset };
}
