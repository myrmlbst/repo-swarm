/** Display helpers shared by the analyses list and its result panels. */

const REPO_PATH =
  /^https?:\/\/(?:www\.)?github\.com\/([^/]+)\/([^/#?]+?)(?:\.git)?\/?(?:[#?].*)?$/i;

/** "https://github.com/octocat/Hello-World" -> { owner: "octocat", name: "Hello-World" } */
export function parseRepo(url: string): { owner: string; name: string } | null {
  const match = REPO_PATH.exec(url.trim());
  return match ? { owner: match[1], name: match[2] } : null;
}

const RELATIVE_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ["year", 60 * 60 * 24 * 365],
  ["month", 60 * 60 * 24 * 30],
  ["day", 60 * 60 * 24],
  ["hour", 60 * 60],
  ["minute", 60],
];

/** "just now", "5 minutes ago", "2 days ago" — for the "submitted" line on each card. */
export function formatRelative(iso: string, now: number = Date.now()): string {
  const seconds = Math.round((new Date(iso).getTime() - now) / 1000);
  const abs = Math.abs(seconds);
  if (abs < 45) return "just now";

  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });
  for (const [unit, size] of RELATIVE_UNITS) {
    if (abs >= size) return rtf.format(Math.round(seconds / size), unit);
  }
  return rtf.format(Math.round(seconds / 60), "minute");
}

export function formatUsd(amount: number): string {
  return `$${amount.toFixed(4)}`;
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat("en").format(value);
}

/** Milliseconds between two ISO timestamps. */
export function elapsedMs(startedAt: string, finishedAt: string): number {
  return new Date(finishedAt).getTime() - new Date(startedAt).getTime();
}

/** 940 -> "0.9s", 102000 -> "1m 42s" */
export function formatDuration(ms: number): string {
  const seconds = ms / 1000;
  if (seconds < 60) return `${seconds.toFixed(1)}s`;
  const minutes = Math.floor(seconds / 60);
  const rest = Math.round(seconds - minutes * 60);
  return `${minutes}m ${rest}s`;
}

/** "cloud_agent" -> "Cloud agent" */
export function agentLabel(agentName: string): string {
  const spaced = agentName.replace(/_/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}
