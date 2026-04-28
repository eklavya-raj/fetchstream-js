"use client";

import { useCallback, useMemo } from "react";
import { useClassicFetch } from "../hooks/useClassicFetch";
import { useStreamFetch } from "../hooks/useStreamFetch";
import { DATASET_URL } from "../app/types";
import BenchmarkPane from "./BenchmarkPane";
import SummaryCard from "./SummaryCard";
import Toolbar from "./Toolbar";

/**
 * Orchestrates the head-to-head:
 *   - left pane:  fetch(url) -> response.json() -> render cards     (`useClassicFetch`)
 *   - right pane: fetchstream live() with raf throttle              (`useStreamFetch`)
 *
 * Both runners are independent hooks so each pane is self-contained.
 */
export default function ComparisonDemo() {
  const classic = useClassicFetch();
  const stream = useStreamFetch();

  const running =
    classic.metrics.status === "running" || stream.metrics.status === "running";
  const hasResult =
    classic.metrics.status === "done" || stream.metrics.status === "done";

  const run = useCallback(() => {
    if (running) return;
    classic.run(DATASET_URL);
    stream.run(DATASET_URL);
  }, [running, classic, stream]);

  const abort = useCallback(() => {
    classic.abort();
    stream.abort();
  }, [classic, stream]);

  const reset = useCallback(() => {
    classic.reset();
    stream.reset();
  }, [classic, stream]);

  // The streaming hook mutates `dataRef.current` in place; capture the live view.
  const streamItems = stream.dataRef.current;

  const totalBytesHint = useMemo(() => {
    // Once either pane has finished, use the larger of the two as the progress denominator.
    const a = classic.metrics.status === "done" ? classic.metrics.bytes : 0;
    const b = stream.metrics.status === "done" ? stream.metrics.bytes : 0;
    const m = Math.max(a, b);
    return m > 0 ? m : null;
  }, [
    classic.metrics.status,
    classic.metrics.bytes,
    stream.metrics.status,
    stream.metrics.bytes,
  ]);

  return (
    <div className="flex w-full max-w-6xl flex-col gap-6">
      <Toolbar
        running={running}
        hasResult={hasResult}
        onRun={run}
        onAbort={abort}
        onReset={reset}
      />

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <BenchmarkPane
          title="fetch + JSON.parse"
          subtitle="await fetch(url).then(r => r.json()) — cards render once."
          badge="Classic"
          accent="amber"
          metrics={classic.metrics}
          items={classic.data}
          totalBytesHint={totalBytesHint}
        />
        <BenchmarkPane
          title="fetchstream"
          subtitle="streamJSON().live(cb, { throttle: 'raf' }) — cards grow as bytes arrive."
          badge="Streaming"
          accent="emerald"
          metrics={stream.metrics}
          items={streamItems}
          totalBytesHint={totalBytesHint}
        />
      </div>

      <SummaryCard classic={classic.metrics} stream={stream.metrics} />
    </div>
  );
}
