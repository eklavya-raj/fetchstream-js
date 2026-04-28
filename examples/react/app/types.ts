export type RunStatus = "idle" | "running" | "done" | "aborted" | "error";

export interface Item {
  id?: string | number;
  name?: string;
  language?: string;
  version?: string | number;
  bio?: string;
}

export interface Metrics {
  status: RunStatus;
  ttfbMs: number | null;
  ttfiMs: number | null;
  totalMs: number | null;
  bytes: number;
  itemsRendered: number;
  errorMessage?: string | null;
}

export const initialMetrics: Metrics = {
  status: "idle",
  ttfbMs: null,
  ttfiMs: null,
  totalMs: null,
  bytes: 0,
  itemsRendered: 0,
  errorMessage: null,
};

export const DATASET_URL =
  "https://microsoftedge.github.io/Demos/json-dummy-data/5MB.json";
