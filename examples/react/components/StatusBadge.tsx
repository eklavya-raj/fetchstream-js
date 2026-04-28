import type { RunStatus } from "../app/types";

const LABELS: Record<RunStatus, string> = {
  idle: "Idle",
  running: "Running",
  done: "Done",
  aborted: "Aborted",
  error: "Error",
};

export type Accent = "amber" | "emerald";

export default function StatusBadge({
  status,
  accent,
}: {
  status: RunStatus;
  accent: Accent;
}) {
  const isActive = status === "running";
  const tone =
    status === "error"
      ? "bg-rose-100 text-rose-900 dark:bg-rose-500/15 dark:text-rose-200"
      : status === "aborted"
        ? "bg-zinc-200 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
        : accent === "amber"
          ? "bg-amber-100 text-amber-900 dark:bg-amber-500/15 dark:text-amber-200"
          : "bg-emerald-100 text-emerald-900 dark:bg-emerald-500/15 dark:text-emerald-200";
  const dotTone =
    status === "error"
      ? "bg-rose-500"
      : status === "aborted"
        ? "bg-zinc-400"
        : accent === "amber"
          ? "bg-amber-500"
          : "bg-emerald-500";
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${tone}`}
    >
      <span
        className={`size-1.5 rounded-full ${dotTone} ${isActive ? "animate-pulse" : ""}`}
      />
      {LABELS[status]}
    </span>
  );
}
