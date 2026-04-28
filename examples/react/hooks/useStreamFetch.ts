"use client";

import { useCallback, useEffect, useReducer, useRef, useState } from "react";
import {  streamJSON } from "fetchstream";
import { initialMetrics, type Item, type Metrics } from "../app/types";
import { streamFrom } from "fetchstream/node";

/**
 * Streaming pattern using the headline `fetchStream(url)` API.
 *
 *   fetchStream(url, { signal })
 *     .live(cb, { throttle: 'raf' })   // library coalesces parser updates
 *                                         onto requestAnimationFrame for us.
 *
 * The library owns the `fetch()` call and the body reader; we just consume
 * the live root snapshot. To still report a wire-accurate `bytes` value (the
 * library hides the underlying `Response`), we fire a parallel HEAD request
 * for `Content-Length` + a TTFB approximation. Both are best-effort; the
 * stream itself succeeds even if the HEAD fails.
 */
export function useStreamFetch() {
  const [metrics, setMetrics] = useState<Metrics>(initialMetrics);
  const dataRef = useRef<Item[]>([]);
  // useReducer to force a re-render on each rAF-throttled mutation without
  // copying the whole array (the parser mutates `dataRef.current` in place).
  const [, tick] = useReducer((x: number) => x + 1, 0);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    dataRef.current = [];
    setMetrics(initialMetrics);
    tick();
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const run = useCallback(async (url: string) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    dataRef.current = [];
    setMetrics({ ...initialMetrics, status: "running" });
    tick();

    const t0 = performance.now();
    let firstItemSeen = false;


    const res = await fetch(url, { signal: ac.signal, cache: "no-store" });
    //save max size of response
    const cl = Number(res.headers.get("content-length"));
    const bytes =
      Number.isFinite(cl) && cl > 0
        ? cl
        : new TextEncoder().encode(JSON.stringify(res.body)).byteLength;


    const handle = streamFrom(res.body!);

    handle.live<Item[]>(
      (root) => {
        dataRef.current = Array.isArray(root) ? root : [];
        const len = dataRef.current.length;
        if (!firstItemSeen && len > 0) {
          firstItemSeen = true;
          const ttfiMs = performance.now() - t0;
          setMetrics((m) => ({ ...m, ttfiMs, itemsRendered: len }));
        } else {
          setMetrics((m) =>
            m.itemsRendered === len ? m : { ...m, itemsRendered: len },
          );
        }
        tick();
      },
      { throttle: "raf" },
    );

    try {
      await handle;

      setMetrics((m) => ({
        ...m,
        status: "done",
        bytes,
        totalMs: performance.now() - t0,
        itemsRendered: dataRef.current.length,
      }));
      tick();
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
