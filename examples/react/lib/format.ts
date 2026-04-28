export function formatBytes(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let i = 0;
  let v = n;
  while (v >= 1024 && i < units.length - 1) {
    v /= 1024;
    i++;
  }
  return `${v.toFixed(v >= 100 || i === 0 ? 0 : v >= 10 ? 1 : 2)} ${units[i]}`;
}

export function formatMs(n: number | null | undefined): string {
  if (n == null || !Number.isFinite(n)) return "—";
  if (n < 1) return `${(n * 1000).toFixed(0)} µs`;
  if (n < 1000) return `${n.toFixed(0)} ms`;
  return `${(n / 1000).toFixed(2)} s`;
}

export function formatNumber(n: number): string {
  return n.toLocaleString("en-US");
}

export function formatThroughput(bytes: number, ms: number): string {
  if (!ms || ms <= 0) return "—";
  const bps = (bytes / ms) * 1000;
  return `${formatBytes(bps)}/s`;
}
