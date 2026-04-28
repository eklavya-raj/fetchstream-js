import { memo } from "react";
import type { Item } from "../app/types";

function DataCardImpl({ item, index }: { item: Item; index: number }) {
  return (
    <article className="flex flex-col gap-2 rounded-lg border border-zinc-200/70 bg-white/80 p-3 transition-colors hover:border-zinc-300 dark:border-zinc-800/70 dark:bg-zinc-950/60 dark:hover:border-zinc-700">
      <header className="flex items-baseline justify-between gap-2">
        <h3 className="min-w-0 truncate text-sm font-semibold text-zinc-900 dark:text-zinc-50">
          {item.name ?? "(unnamed)"}
        </h3>
        <span className="shrink-0 font-mono text-[10px] tabular-nums text-zinc-400 dark:text-zinc-600">
          #{index + 1}
        </span>
      </header>
      {item.language ? (
        <div className="flex items-center gap-1.5">
          <span className="rounded bg-zinc-100 px-1.5 py-0.5 font-mono text-[10px] text-zinc-700 dark:bg-zinc-900 dark:text-zinc-300">
            {item.language}
            {item.version != null ? (
              <span className="text-zinc-400 dark:text-zinc-500">
                {" "}
                · {item.version}
              </span>
            ) : null}
          </span>
        </div>
      ) : null}
      {item.bio ? (
        <p className="line-clamp-2 text-xs leading-5 text-zinc-600 dark:text-zinc-400">
          {item.bio}
        </p>
      ) : null}
    </article>
  );
}

const DataCard = memo(DataCardImpl);
export default DataCard;
