"use client";

import { DATASET_URL } from "../types";

export default function Toolbar({
  running,
  hasResult,
  onRun,
  onAbort,
  onReset,
}: {
  running: boolean;
  hasResult: boolean;
  onRun: () => void;
  onAbort: () => void;
  onReset: () => void;
}) {
  return (
    <div className="flex flex-col items-stretch gap-3 rounded-2xl border border-zinc-200 bg-white/60 p-4 backdrop-blur-sm sm:flex-row sm:items-center dark:border-zinc-800 dark:bg-zinc-950/40">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <span className="hidden size-9 shrink-0 items-center justify-center rounded-lg bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900 sm:inline-flex">
          <DatabaseIcon />
        </span>
        <div className="min-w-0">
          <div className="text-[10px] font-medium uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Dataset
          </div>
          <a
            href={DATASET_URL}
            target="_blank"
            rel="noreferrer"
            className="block truncate font-mono text-xs text-zinc-700 hover:underline dark:text-zinc-300"
          >
            {DATASET_URL}
          </a>
        </div>
        <span className="hidden shrink-0 rounded-md bg-zinc-100 px-2 py-1 font-mono text-[10px] font-semibold text-zinc-600 dark:bg-zinc-900 dark:text-zinc-400 md:inline">
          ~5 MB · array of objects
        </span>
      </div>
      <div className="flex shrink-0 items-center gap-2">
        <button
          type="button"
          onClick={onReset}
          disabled={running}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-zinc-200 bg-white px-3 text-sm font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          Reset
        </button>
        {running ? (
          <button
            type="button"
            onClick={onAbort}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-rose-600 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-rose-700"
          >
            <StopIcon />
            Abort
          </button>
        ) : (
          <button
            type="button"
            onClick={onRun}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-zinc-900 px-4 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-zinc-800 dark:bg-zinc-50 dark:text-zinc-900 dark:hover:bg-zinc-200"
          >
            <PlayIcon />
            {hasResult ? "Run again" : "Run benchmark"}
          </button>
        )}
      </div>
    </div>
  );
}

function PlayIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <path fill="currentColor" d="M4.5 3.5v9l8-4.5-8-4.5z" />
    </svg>
  );
}

function StopIcon() {
  return (
    <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
      <rect x="4" y="4" width="8" height="8" rx="1.5" fill="currentColor" />
    </svg>
  );
}

function DatabaseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      width="18"
      height="18"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <ellipse cx="12" cy="5" rx="8" ry="3" />
      <path d="M4 5v6c0 1.66 3.58 3 8 3s8-1.34 8-3V5" />
      <path d="M4 11v6c0 1.66 3.58 3 8 3s8-1.34 8-3v-6" />
    </svg>
  );
}
