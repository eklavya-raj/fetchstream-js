import type { Accent } from "./StatusBadge";

const BAR: Record<Accent, string> = {
  amber: "bg-gradient-to-r from-amber-400 to-rose-400",
  emerald: "bg-gradient-to-r from-emerald-400 to-teal-400",
};

export default function ProgressBar({
  bytes,
  totalBytes,
  active,
  accent,
}: {
  bytes: number;
  totalBytes: number | null;
  active: boolean;
  accent: Accent;
}) {
  const pct =
    totalBytes && totalBytes > 0
      ? Math.min(100, (bytes / totalBytes) * 100)
      : active
        ? null
        : 0;
  return (
    <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-zinc-200/70 dark:bg-zinc-800/70">
      {pct == null ? (
        <div
          className={`absolute inset-y-0 left-0 w-1/3 ${BAR[accent]}`}
          style={{ animation: "fs-indeterminate 1.4s ease-in-out infinite" }}
        />
      ) : (
        <div
          className={`h-full ${BAR[accent]} transition-[width] duration-150 ease-out`}
          style={{ width: `${pct}%` }}
        />
      )}
    </div>
  );
}
