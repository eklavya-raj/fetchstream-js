export default function MetricCard({
  label,
  value,
  hint,
  highlight,
}: {
  label: string;
  value: string;
  hint?: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex flex-col gap-0.5 rounded-lg border border-zinc-200/60 bg-white/70 p-3 backdrop-blur-sm dark:border-zinc-800/60 dark:bg-zinc-950/40">
      <span className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <span
        className={`font-mono text-base font-semibold tabular-nums ${
          highlight
            ? "text-zinc-900 dark:text-zinc-50"
            : "text-zinc-800 dark:text-zinc-200"
        }`}
      >
        {value}
      </span>
      {hint ? (
        <span className="text-[10px] text-zinc-400 dark:text-zinc-500">{hint}</span>
      ) : null}
    </div>
  );
}
