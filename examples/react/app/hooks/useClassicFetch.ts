"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { initialMetrics, type Item, type Metrics } from "../types";

interface ClassicState {
  metrics: Metrics;
  data: Item[];
}

const INITIAL: ClassicState = { metrics: initialMetrics, data: [] };

/**
 * Classic, blocking pattern: `fetch(url) -> response.json() -> render`.
 *
 * The whole body must be downloaded AND parsed before the UI sees anything,
 * so `ttfiMs` is effectively the total time.
 */
export function useClassicFetch() {
  const [state, setState] = useState<ClassicState>(INITIAL);
  const abortRef = useRef<AbortController | null>(null);

  const reset = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setState(INITIAL);
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  const run = useCallback(async (url: string) => {
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;

    setState({ metrics: { ...initialMetrics, status: "running" }, data: [] });
    const t0 = performance.now();

    try {
      const res = await fetch(url, { signal: ac.signal, cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const ttfbMs = performance.now() - t0;
      const cl = Number(res.headers.get("content-length"));

      const data = (await res.json()) as Item[];
      const totalMs = performance.now() - t0;

      // Bytes: prefer Content-Length, fall back to UTF-8 size of the parsed JSON.
      const bytes =
        Number.isFinite(cl) && cl > 0
          ? cl
          : new TextEncoder().encode(JSON.stringify(data)).byteLength;

      setState({
        data,
        metrics: {
          status: "done",
          ttfbMs,
          ttfiMs: totalMs, // first row only painted after JSON.parse finishes
          totalMs,
          bytes,
          itemsRendered: data.length,
          errorMessage: null,
        },
      });
    } catch (e) {
      if (ac.signal.aborted) {
        setState((s) => ({ ...s, metrics: { ...s.metrics, status: "aborted" } }));
        return;
      }
      setState((s) => ({
        ...s,
        metrics: {
          ...s.metrics,
          status: "error",
          errorMessage: e instanceof Error ? e.message : String(e),
        },
      }));
    }
  }, []);

  useEffect(() => () => abortRef.current?.abort(), []);

  return { ...state, run, abort, reset };
}
