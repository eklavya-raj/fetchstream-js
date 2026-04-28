"use client";

import { memo } from "react";
import { formatBytes, formatMs, formatNumber } from "../lib/format";
import type { Item, Metrics } from "../app/types";
import DataCard from "./DataCard";
import MetricCard from "./MetricCard";
import ProgressBar from "./ProgressBar";
import StatusBadge, { type Accent } from "./StatusBadge";

const VISIBLE = 30;

const ACCENT_STYLES: Record<
  Accent,
  { border: string; bg: string; chip: string; glow: string }
> = {
  amber: {
    border: "border-amber-200/60 dark:border-amber-500/20",
    bg: "bg-gradient-to-br from-amber-50 to-rose-50/60 dark:from-amber-500/5 dark:to-rose-500/5",
    chip: "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200",
    glow: "shadow-[0_0_0_1px_rgba(251,191,36,0.15),0_20px_40px_-20px_rgba(244,63,94,0.25)]",
  },
  emerald: {
    border: "border-emerald-200/60 dark:border-emerald-400/20",
    bg: "bg-gradient-to-br from-emerald-50 to-teal-50/60 dark:from-emerald-500/5 dark:to-teal-500/5",
    chip: "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-200",
    glow: "shadow-[0_0_0_1px_rgba(16,185,129,0.15),0_20px_40px_-20px_rgba(20,184,166,0.3)]",
  },
};

interface BenchmarkPaneProps {
  title: string;
  subtitle: string;
  badge: string;
  accent: Accent;
  metrics: Metrics;
  items: ReadonlyArray<Item>;
  totalBytesHint?: number | null;
}

function BenchmarkPaneImpl({
  title,
  subtitle,
  badge,
  accent,
  metrics,
  items,
  totalBytesHint = null,
}: BenchmarkPaneProps) {
  const styles = ACCENT_STYLES[accent];
  const active = metrics.status === "running";
  const visible = items.slice(0, VISIBLE);
  const overflow = Math.max(0, items.length - visible.length);

  return (
    <section
      className={`flex h-full flex-col rounded-2xl border ${styles.border} ${styles.bg} ${styles.glow} overflow-hidden`}
      aria-label={title}
    >
      <PaneHeader
        title={title}
        subtitle={subtitle}
        badge={badge}
        accent={accent}
        chipClass={styles.chip}
        status={metrics.status}
      />
      <div className="border-b border-zinc-200/60 px-5 pb-4 dark:border-zinc-800/60">
        <ProgressBar
          bytes={metrics.bytes}
          totalBytes={totalBytesHint}
          active={active}
          accent={accent}
        />
      </div>

      <PaneMetrics metrics={metrics} />

      <PaneCards
        visible={visible}
        overflow={overflow}
        total={metrics.itemsRendered}
        status={metrics.status}
      />

      {metrics.errorMessage ? (
        <div className="border-t border-rose-200/60 bg-rose-50 px-5 py-2 text-xs text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
          {metrics.errorMessage}
        </div>
      ) : null}
    </section>
  );
}

function PaneHeader({
  title,
  subtitle,
  badge,
  accent,
  chipClass,
  status,
}: {
  title: string;
  subtitle: string;
  badge: string;
  accent: Accent;
  chipClass: string;
  status: Metrics["status"];
}) {
  return (
    <header className="flex flex-col gap-3 bg-white/40 px-5 pt-4 pb-3 backdrop-blur-sm dark:bg-zinc-950/30">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={`rounded-md px-1.5 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wider ${chipClass}`}
            >
              {badge}
            </span>
            <h2 className="truncate text-base font-semibold text-zinc-900 dark:text-zinc-50">
              {title}
            </h2>
          </div>
          <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
            {subtitle}
          </p>
        </div>
        <StatusBadge status={status} accent={accent} />
      </div>
    </header>
  );
}

function PaneMetrics({ metrics }: { metrics: Metrics }) {
  return (
    <div className="grid grid-cols-2 gap-2 border-b border-zinc-200/60 px-5 py-4 sm:grid-cols-3 dark:border-zinc-800/60">
      <MetricCard
        label="Time to first item"
        value={formatMs(metrics.ttfiMs)}
        hint="When UI saw row #1"
        highlight
      />
      <MetricCard
        label="Items rendered"
        value={formatNumber(metrics.itemsRendered)}
      />
      <MetricCard label="Total time" value={formatMs(metrics.totalMs)} />
      <MetricCard label="Bytes received" value={formatBytes(metrics.bytes)} />
      <MetricCard label="Time to first byte" value={formatMs(metrics.ttfbMs)} />
      <MetricCard label="Status" value={statusValue(metrics.status)} />
    </div>
  );
}

function PaneCards({
  visible,
  overflow,
  total,
  status,
}: {
  visible: ReadonlyArray<Item>;
  overflow: number;
  total: number;
  status: Metrics["status"];
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between px-5 py-2 text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        <span>Cards</span>
        <span className="font-mono tabular-nums">
          showing {visible.length} of {formatNumber(total)}
        </span>
      </div>
      <div className="relative max-h-[420px] flex-1 overflow-y-auto px-5 pb-5">
        {visible.length === 0 ? (
          <EmptyState status={status} />
        ) : (
          <>
            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {visible.map((item, i) => (
                <DataCard
                  key={`${i}-${item.id ?? item.name ?? i}`}
                  item={item}
                  index={i}
                />
              ))}
            </div>
            {overflow > 0 ? (
              <div className="mt-3 text-center text-xs text-zinc-500 dark:text-zinc-400">
                + {formatNumber(overflow)} more cards rendered above the fold
              </div>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState({ status }: { status: Metrics["status"] }) {
  return (
    <div className="flex h-[200px] items-center justify-center text-sm text-zinc-400 dark:text-zinc-600">
      {status === "idle"
        ? "Press Run to start"
        : status === "running"
          ? "Waiting for first item…"
          : "No data"}
    </div>
  );
}

function statusValue(s: Metrics["status"]): string {
  switch (s) {
    case "idle":
      return "Idle";
    case "running":
      return "Running";
    case "done":
      return "Done";
    case "aborted":
      return "Aborted";
    case "error":
      return "Error";
  }
}

const BenchmarkPane = memo(BenchmarkPaneImpl);
export default BenchmarkPane;
