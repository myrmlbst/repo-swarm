"use client";

import { useCallback, useEffect, useState, type ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  listAnalyses,
  getFindings,
  getTrace,
  type Analysis,
  type Finding,
  type AgentRun,
} from "@/lib/api";
import { elapsedMs, formatRelative, parseRepo } from "@/lib/format";
import { FOCUS_RING } from "@/lib/styles";
import { buildReportMarkdown } from "@/lib/report";
import { SubmitRepoForm } from "./SubmitRepoForm";
import { MarkdownProposal } from "./MarkdownProposal";
import { FindingsList } from "./FindingsList";
import { UsageSummary } from "./UsageSummary";
import { StatusBadge } from "./StatusBadge";
import {
  AlertCircleIcon,
  AlertTriangleIcon,
  CheckIcon,
  ChevronDownIcon,
  CopyIcon,
  DownloadIcon,
  ExternalLinkIcon,
  GitHubIcon,
  SearchIcon,
} from "./icons";

// While anything's still processing, poll so the badge (and an open row)
// catch up to "complete"/"failed" without a manual reload.
const POLL_INTERVAL_MS = 4000;

// Shared by both the findings and the usage/cost trace — each analysis's
// two lazily-fetched sections track their own fetch state independently.
type LoadState = "loading" | "error" | "ready";

const SECONDARY_BUTTON = `inline-flex h-9 items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50 active:bg-gray-100 ${FOCUS_RING}`;

function PanelSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2 text-sm font-semibold text-gray-900">{title}</h3>
      {children}
    </div>
  );
}

function SectionError({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="flex items-start gap-2 text-sm text-red-700">
      <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
      {children}
    </p>
  );
}

function LoadingLines() {
  return (
    <div role="status" className="space-y-2">
      <span className="sr-only">Loading...</span>
      <div
        aria-hidden="true"
        className="h-14 animate-pulse rounded-lg bg-gray-200/70"
      />
      <div
        aria-hidden="true"
        className="h-14 animate-pulse rounded-lg bg-gray-200/70"
      />
    </div>
  );
}

function ListSkeleton() {
  return (
    <div role="status" aria-live="polite">
      <span className="sr-only">Loading your analyses...</span>
      <ul aria-hidden="true" className="space-y-3">
        {[0, 1].map((i) => (
          <li
            key={i}
            className="flex animate-pulse items-center justify-between gap-4 rounded-2xl border border-gray-200 bg-white p-4"
          >
            <div className="space-y-2">
              <div className="h-4 w-44 rounded bg-gray-200" />
              <div className="h-3 w-24 rounded bg-gray-100" />
            </div>
            <div className="h-6 w-20 rounded-full bg-gray-200" />
          </li>
        ))}
      </ul>
    </div>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed border-gray-300 bg-white/60 px-6 py-12 text-center">
      <div className="mx-auto grid size-12 place-items-center rounded-full bg-blue-50 text-blue-700">
        <SearchIcon className="size-6" />
      </div>
      <h3 className="mt-4 text-sm font-semibold text-gray-900">
        No analyses yet
      </h3>
      <p className="mx-auto mt-1 max-w-sm text-sm text-gray-600">
        Paste a public GitHub URL above and your first review will show up here.
      </p>
    </div>
  );
}

export function AnalysesList() {
  const [analyses, setAnalyses] = useState<Analysis[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [findingsByAnalysis, setFindingsByAnalysis] = useState<
    Record<string, Finding[]>
  >({});
  const [findingsState, setFindingsState] = useState<Record<string, LoadState>>(
    {},
  );
  const [traceByAnalysis, setTraceByAnalysis] = useState<
    Record<string, AgentRun[]>
  >({});
  const [traceState, setTraceState] = useState<Record<string, LoadState>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [printTarget, setPrintTarget] = useState<{
    analysis: Analysis;
    findings: Finding[];
  } | null>(null);

  const refresh = useCallback(async () => {
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const { analyses } = await listAnalyses(session.access_token);
      setAnalyses(analyses);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load analyses");
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const activeCount =
    analyses?.filter((a) => a.status === "queued" || a.status === "running")
      .length ?? 0;

  // Keep the expanded row's own copy of the analysis (status, proposal, ...)
  // in sync as refresh() brings in newer data, e.g. queued -> complete.
  useEffect(() => {
    if (activeCount === 0) return;
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [activeCount, refresh]);

  async function toggleExpand(analysis: Analysis) {
    if (expandedId === analysis.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(analysis.id);

    if (analysis.status !== "complete") return;

    const supabase = createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session) return;

    if (!findingsByAnalysis[analysis.id]) {
      setFindingsState((s) => ({ ...s, [analysis.id]: "loading" }));
      try {
        const { findings } = await getFindings(
          session.access_token,
          analysis.id,
        );
        setFindingsByAnalysis((f) => ({ ...f, [analysis.id]: findings }));
        setFindingsState((s) => ({ ...s, [analysis.id]: "ready" }));
      } catch {
        setFindingsState((s) => ({ ...s, [analysis.id]: "error" }));
      }
    }

    if (!traceByAnalysis[analysis.id]) {
      setTraceState((s) => ({ ...s, [analysis.id]: "loading" }));
      try {
        const { runs } = await getTrace(session.access_token, analysis.id);
        setTraceByAnalysis((t) => ({ ...t, [analysis.id]: runs }));
        setTraceState((s) => ({ ...s, [analysis.id]: "ready" }));
      } catch {
        setTraceState((s) => ({ ...s, [analysis.id]: "error" }));
      }
    }
  }

  // Print the hidden print-only report view (below) once it's populated with
  // the target analysis, then clear it once the print dialog closes —
  // covers both "printed" and "cancelled" since afterprint fires either way.
  useEffect(() => {
    if (!printTarget) return;
    const timer = setTimeout(() => window.print(), 50);
    const handleAfterPrint = () => setPrintTarget(null);
    window.addEventListener("afterprint", handleAfterPrint);
    return () => {
      clearTimeout(timer);
      window.removeEventListener("afterprint", handleAfterPrint);
    };
  }, [printTarget]);

  async function handleCopy(analysis: Analysis) {
    const report = buildReportMarkdown(
      analysis,
      findingsByAnalysis[analysis.id] ?? [],
    );
    try {
      await navigator.clipboard.writeText(report);
      setCopiedId(analysis.id);
      setTimeout(
        () => setCopiedId((id) => (id === analysis.id ? null : id)),
        2000,
      );
    } catch {
      setError("Couldn't copy to clipboard. Your browser may be blocking it.");
    }
  }

  function handleDownloadPdf(analysis: Analysis) {
    setPrintTarget({
      analysis,
      findings: findingsByAnalysis[analysis.id] ?? [],
    });
  }

  return (
    <>
      <div className="space-y-8 print:hidden">
        <SubmitRepoForm onSubmitted={refresh} />

        <section className="space-y-3">
          <div className="flex items-end justify-between gap-3">
            <h2 className="text-lg font-semibold tracking-tight text-gray-900">
              Your analyses
            </h2>
            {analyses !== null && analyses.length > 0 && (
              <p className="flex items-center gap-3 text-sm text-gray-600">
                {activeCount > 0 && (
                  <span className="inline-flex items-center gap-1.5">
                    <span
                      aria-hidden="true"
                      className="size-1.5 animate-pulse rounded-full bg-blue-600"
                    />
                    Updating live
                  </span>
                )}
                <span>{analyses.length} total</span>
              </p>
            )}
          </div>

          {/* Announces progress to screen readers; the visible badges alone
              change silently as the list polls. */}
          <p role="status" className="sr-only">
            {activeCount > 0
              ? `${activeCount} ${activeCount === 1 ? "analysis is" : "analyses are"} in progress.`
              : ""}
          </p>

          {error && (
            <div
              role="alert"
              className="flex items-start gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800"
            >
              <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
              {error}
            </div>
          )}

          {analyses === null ? (
            <ListSkeleton />
          ) : analyses.length === 0 ? (
            <EmptyState />
          ) : (
            <ul className="space-y-3">
              {analyses.map((analysis) => {
                const isExpanded = expandedId === analysis.id;
                const canExpand =
                  analysis.status === "complete" ||
                  analysis.status === "failed";
                const repo = parseRepo(analysis.repo_url);
                const panelId = `analysis-${analysis.id}-details`;
                const totalElapsed = analysis.completed_at
                  ? elapsedMs(analysis.created_at, analysis.completed_at)
                  : null;

                return (
                  <li
                    key={analysis.id}
                    className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm"
                  >
                    <div className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0">
                        <a
                          href={analysis.repo_url}
                          target="_blank"
                          rel="noreferrer"
                          className={`group inline-flex max-w-full items-center gap-2 rounded-md font-medium text-gray-900 hover:text-blue-700 ${FOCUS_RING}`}
                        >
                          <GitHubIcon className="size-4 shrink-0 text-gray-600" />
                          <span className="truncate">
                            {repo ? (
                              <>
                                <span className="font-normal text-gray-600 group-hover:text-blue-700">
                                  {repo.owner}/
                                </span>
                                {repo.name}
                              </>
                            ) : (
                              analysis.repo_url
                            )}
                          </span>
                          <ExternalLinkIcon className="size-3.5 shrink-0 text-gray-500 group-hover:text-blue-700" />
                          <span className="sr-only">(opens in a new tab)</span>
                        </a>
                        <p className="mt-0.5 text-xs text-gray-600">
                          Submitted{" "}
                          <time dateTime={analysis.created_at}>
                            {formatRelative(analysis.created_at)}
                          </time>
                        </p>
                      </div>

                      <div className="flex shrink-0 items-center justify-between gap-2 sm:justify-end">
                        <StatusBadge status={analysis.status} />
                        {canExpand && (
                          <button
                            type="button"
                            onClick={() => toggleExpand(analysis)}
                            aria-expanded={isExpanded}
                            aria-controls={isExpanded ? panelId : undefined}
                            className={`inline-flex h-9 items-center gap-1 rounded-lg px-3 text-sm font-medium text-gray-700 hover:bg-gray-100 ${FOCUS_RING}`}
                          >
                            {isExpanded ? "Hide details" : "Details"}
                            <ChevronDownIcon
                              className={`size-4 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                            />
                          </button>
                        )}
                      </div>
                    </div>

                    {isExpanded && (
                      <div
                        id={panelId}
                        className="space-y-6 border-t border-gray-200 bg-gray-50/70 p-3 sm:p-5"
                      >
                        {analysis.status === "failed" && (
                          <div className="flex items-start gap-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                            <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
                            <p>
                              This analysis failed before producing a result.
                              Check the agents worker&apos;s logs for the error.
                            </p>
                          </div>
                        )}

                        {analysis.status === "complete" && (
                          <>
                            <div className="flex flex-wrap items-center justify-between gap-3">
                              {analysis.review_approved !== null ? (
                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                                    analysis.review_approved
                                      ? "bg-green-100 text-green-800"
                                      : "bg-amber-100 text-amber-900"
                                  }`}
                                >
                                  {analysis.review_approved ? (
                                    <CheckIcon className="size-3.5" />
                                  ) : (
                                    <AlertTriangleIcon className="size-3.5" />
                                  )}
                                  {analysis.review_approved
                                    ? "Review approved"
                                    : "Review flagged concerns"}
                                </span>
                              ) : (
                                <span />
                              )}

                              {findingsState[analysis.id] === "ready" && (
                                <div className="flex flex-wrap items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleCopy(analysis)}
                                    className={SECONDARY_BUTTON}
                                  >
                                    {copiedId === analysis.id ? (
                                      <CheckIcon className="size-4 text-green-700" />
                                    ) : (
                                      <CopyIcon className="size-4" />
                                    )}
                                    {copiedId === analysis.id
                                      ? "Copied"
                                      : "Copy report"}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDownloadPdf(analysis)}
                                    className={SECONDARY_BUTTON}
                                  >
                                    <DownloadIcon className="size-4" />
                                    Download as PDF
                                  </button>
                                  {/* Announces the copy result; the button
                                      label change alone isn't announced. */}
                                  <span role="status" className="sr-only">
                                    {copiedId === analysis.id
                                      ? "Report copied to clipboard."
                                      : ""}
                                  </span>
                                </div>
                              )}
                            </div>

                            {analysis.proposal && (
                              <PanelSection title="Proposal">
                                <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm sm:p-4">
                                  <MarkdownProposal
                                    content={analysis.proposal}
                                    headingOffset={3}
                                  />
                                </div>
                              </PanelSection>
                            )}

                            <PanelSection title="Findings">
                              {findingsState[analysis.id] === "loading" && (
                                <LoadingLines />
                              )}
                              {findingsState[analysis.id] === "error" && (
                                <SectionError>
                                  Failed to load findings.
                                </SectionError>
                              )}
                              {findingsState[analysis.id] === "ready" && (
                                <FindingsList
                                  findings={findingsByAnalysis[analysis.id]}
                                />
                              )}
                            </PanelSection>

                            <PanelSection title="Usage & cost">
                              {traceState[analysis.id] === "loading" && (
                                <LoadingLines />
                              )}
                              {traceState[analysis.id] === "error" && (
                                <SectionError>
                                  Failed to load usage data.
                                </SectionError>
                              )}
                              {traceState[analysis.id] === "ready" && (
                                <UsageSummary
                                  runs={traceByAnalysis[analysis.id]}
                                  totalElapsedMs={totalElapsed}
                                />
                              )}
                            </PanelSection>
                          </>
                        )}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Print-only view: populated by "Download as PDF", never shown
        on-screen. window.print() (triggered in the effect above) is what
        actually turns this into a PDF via the browser's own print/save
        dialog — no PDF-rendering dependency needed. */}
      {printTarget && (
        <div className="hidden print:block">
          <MarkdownProposal
            content={buildReportMarkdown(
              printTarget.analysis,
              printTarget.findings,
            )}
          />
        </div>
      )}
    </>
  );
}
