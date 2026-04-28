import { formatMs } from "../lib/format";
import type { Metrics } from "../types";

export default function SummaryCard({
  classic,
  stream,
}: {
  classic: Metrics;
  stream: Metrics;
}) {
  const a = classic.ttfiMs;
  const b = stream.ttfiMs;
  const ready =
    a != null && b != null && b > 0 && a > 0 && classic.status === "done" && stream.status === "done";

  if (!ready) {
    return (
      <div className="rounded-2xl border border-dashed border-zinc-200 bg-white/40 p-5 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-950/40 dark:text-zinc-400">
        Run the benchmark to see how much sooner streaming gives you the first
        visible row. Total transfer time is similar — that&apos;s network-bound —
        but{" "}
        <span className="font-semibold text-zinc-800 dark:text-zinc-200">
          time-to-first-paint
        </span>{" "}
        is where streaming wins.
      </div>
    );
  }

  const speedup = a! / b!;
  const totalDelta =
    classic.totalMs != null && stream.totalMs != null
      ? classic.totalMs - stream.totalMs
      : null;

  return (
    <div className="rounded-2xl border border-zinc-200 bg-gradient-to-br from-emerald-50 via-white to-amber-50 p-5 dark:border-zinc-800 dark:from-emerald-500/5 dark:via-zinc-950/40 dark:to-amber-500/5">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Time-to-first-item speedup
          </div>
          <div className="mt-1 font-mono text-3xl font-semibold tabular-nums text-emerald-700 dark:text-emerald-300">
            {speedup >= 100 ? speedup.toFixed(0) : speedup.toFixed(1)}×
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            {formatMs(a)} → {formatMs(b)}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Total transfer time
          </div>
          <div className="mt-1 font-mono text-2xl font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
            {formatMs(stream.totalMs)}
          </div>
          <div className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            classic {formatMs(classic.totalMs)}{" "}
            {totalDelta != null && (
              <span className="font-mono">
                (Δ {totalDelta >= 0 ? "+" : ""}
                {formatMs(Math.abs(totalDelta))})
              </span>
            )}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Takeaway
          </div>
          <p className="mt-1 text-sm text-zinc-700 dark:text-zinc-300">
            Both finish at network speed.{" "}
            <span className="font-semibold">fetchstream</span> shows row #1{" "}
            ~{speedup >= 10 ? speedup.toFixed(0) : speedup.toFixed(1)}× sooner so
            users see content while bytes are still arriving.
          </p>
        </div>
      </div>
    </div>
  );
}
