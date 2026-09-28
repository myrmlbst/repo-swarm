import type { ComponentType } from "react";
import type { Finding } from "@/lib/api";
import { agentLabel } from "@/lib/format";
import { sourceUrlFor } from "@/lib/sources";
import { FOCUS_RING } from "@/lib/styles";
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  ChevronDownIcon,
  ExternalLinkIcon,
  InfoIcon,
} from "./icons";

type Severity = Finding["severity"];

const SEVERITY: Record<
  Severity,
  {
    label: string;
    rank: number;
    badge: string;
    accent: string;
    Icon: ComponentType<{ className?: string }>;
  }
> = {
  critical: {
    label: "Critical",
    rank: 0,
    badge: "bg-red-100 text-red-800",
    accent: "border-l-red-500",
    Icon: AlertCircleIcon,
  },
  warn: {
    label: "Warning",
    rank: 1,
    badge: "bg-amber-100 text-amber-900",
    accent: "border-l-amber-500",
    Icon: AlertTriangleIcon,
  },
  info: {
    label: "Info",
    rank: 2,
    badge: "bg-sky-100 text-sky-900",
    accent: "border-l-sky-400",
    Icon: InfoIcon,
  },
};

function SeverityBadge({ severity }: { severity: Severity }) {
  const { label, badge, Icon } = SEVERITY[severity];
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${badge}`}
    >
      <Icon className="size-3" />
      {label}
    </span>
  );
}

function FindingCard({ finding }: { finding: Finding }) {
  return (
    <li
      className={`rounded-lg border border-l-4 border-gray-200 bg-white p-3 shadow-sm ${SEVERITY[finding.severity].accent}`}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
        <SeverityBadge severity={finding.severity} />
        <span className="text-xs text-gray-600">
          {agentLabel(finding.agent_name)}
        </span>
        {finding.disputed && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900">
            Disputed by review
          </span>
        )}
      </div>

      {/* code_agent issues put a whole sentence in the title; bold at that
          length reads as a wall of text, so only short titles get weight. */}
      <p
        className={`mt-1.5 text-sm text-gray-900 ${
          finding.title.length > 100 ? "leading-relaxed" : "font-medium"
        }`}
      >
        {finding.title}
      </p>
      {finding.detail !== finding.title && (
        <p className="mt-1 text-sm leading-relaxed text-gray-600">
          {finding.detail}
        </p>
      )}

      {finding.source_refs.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-gray-600">Sources</span>
          {finding.source_refs.map((path) => {
            const url = sourceUrlFor(path);
            // A knowledge-doc citation with a verified external source
            // (AWS/OWASP) links out; a repo-code path or an internal doc
            // with no faithful 1:1 source stays a plain, unlinked chip.
            return url ? (
              <a
                key={path}
                href={url}
                target="_blank"
                rel="noreferrer"
                className={`inline-flex items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-xs break-all text-gray-700 hover:bg-gray-200 hover:text-blue-700 ${FOCUS_RING}`}
              >
                {path}
                <ExternalLinkIcon className="size-3 shrink-0" />
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            ) : (
              <code
                key={path}
                className="rounded-md bg-gray-100 px-1.5 py-0.5 font-mono text-xs break-all text-gray-700"
              >
                {path}
              </code>
            );
          })}
        </div>
      )}
    </li>
  );
}

/**
 * Findings sorted most-severe first. Critical + warning findings are always
 * visible; informational ones sit behind a native <details> so a run with
 * 20+ low-signal notes doesn't bury the ones that need action.
 */
export function FindingsList({ findings }: { findings: Finding[] }) {
  if (findings.length === 0) {
    return <p className="text-sm text-gray-600">No findings reported.</p>;
  }

  const sorted = [...findings].sort(
    (a, b) => SEVERITY[a.severity].rank - SEVERITY[b.severity].rank,
  );
  const important = sorted.filter((f) => f.severity !== "info");
  const info = sorted.filter((f) => f.severity === "info");

  const counts = (Object.keys(SEVERITY) as Severity[])
    .map((severity) => ({
      severity,
      count: findings.filter((f) => f.severity === severity).length,
    }))
    .filter(({ count }) => count > 0);

  return (
    <div className="space-y-3">
      <ul aria-label="Findings by severity" className="flex flex-wrap gap-2">
        {counts.map(({ severity, count }) => {
          const { label, badge, Icon } = SEVERITY[severity];
          return (
            <li
              key={severity}
              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${badge}`}
            >
              <Icon className="size-3.5" />
              {label}
              <span className="tabular-nums">{count}</span>
            </li>
          );
        })}
      </ul>

      {important.length > 0 && (
        <ul className="space-y-2">
          {important.map((finding) => (
            <FindingCard key={finding.id} finding={finding} />
          ))}
        </ul>
      )}

      {info.length > 0 &&
        (important.length === 0 ? (
          <ul className="space-y-2">
            {info.map((finding) => (
              <FindingCard key={finding.id} finding={finding} />
            ))}
          </ul>
        ) : (
          <details className="group">
            <summary
              className={`flex w-fit cursor-pointer list-none items-center gap-1.5 rounded-md px-1 py-1 text-sm font-medium text-gray-700 hover:text-gray-900 [&::-webkit-details-marker]:hidden ${FOCUS_RING}`}
            >
              <ChevronDownIcon className="size-4 transition-transform group-open:rotate-180" />
              <span className="group-open:hidden">
                Show {info.length} informational{" "}
                {info.length === 1 ? "finding" : "findings"}
              </span>
              <span className="hidden group-open:inline">
                Hide informational findings
              </span>
            </summary>
            <ul className="mt-2 space-y-2">
              {info.map((finding) => (
                <FindingCard key={finding.id} finding={finding} />
              ))}
            </ul>
          </details>
        ))}
    </div>
  );
}
