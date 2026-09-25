"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  listAnalyses,
  getFindings,
  type Analysis,
  type Finding,
} from "@/lib/api";
import { SubmitRepoForm } from "./SubmitRepoForm";
import { MarkdownProposal } from "./MarkdownProposal";
import { FOCUS_RING } from "@/lib/styles";
import { buildReportMarkdown } from "@/lib/report";

const STATUS_STYLES: Record<Analysis["status"], string> = {
  queued: "bg-gray-100 text-gray-700",
  running: "bg-blue-100 text-blue-700",
  complete: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

const SEVERITY_STYLES: Record<Finding["severity"], string> = {
  info: "bg-gray-100 text-gray-700",
  warn: "bg-amber-100 text-amber-700",
  critical: "bg-red-100 text-red-700",
};

// While anything's still processing, poll so the badge (and an open row)
// catch up to "complete"/"failed" without a manual reload.
const POLL_INTERVAL_MS = 4000;

type FindingsState = "loading" | "error" | "ready";

export function AnalysesList() {
  const [analyses, setAnalyses] = useState<Analysis[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [findingsByAnalysis, setFindingsByAnalysis] = useState<
    Record<string, Finding[]>
  >({});
  const [findingsState, setFindingsState] = useState<
    Record<string, FindingsState>
  >({});
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

  // Keep the expanded row's own copy of the analysis (status, proposal, ...)
  // in sync as refresh() brings in newer data, e.g. queued -> complete.
  useEffect(() => {
    const hasActive = analyses?.some(
      (a) => a.status === "queued" || a.status === "running",
    );
    if (!hasActive) return;
    const interval = setInterval(refresh, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [analyses, refresh]);

  async function toggleExpand(analysis: Analysis) {
    if (expandedId === analysis.id) {
      setExpandedId(null);
      return;
    }
    setExpandedId(analysis.id);

    if (analysis.status !== "complete" || findingsByAnalysis[analysis.id]) {
      return;
    }

    setFindingsState((s) => ({ ...s, [analysis.id]: "loading" }));
    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) return;

      const { findings } = await getFindings(session.access_token, analysis.id);
      setFindingsByAnalysis((f) => ({ ...f, [analysis.id]: findings }));
      setFindingsState((s) => ({ ...s, [analysis.id]: "ready" }));
    } catch {
      setFindingsState((s) => ({ ...s, [analysis.id]: "error" }));
    }
  }

  // Print the hidden #print-report view (below) once it's populated with
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
        1500,
      );
    } catch {
      setError("Couldn't copy to clipboard — your browser may be blocking it.");
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
      <div className="space-y-6 print:hidden">
        <SubmitRepoForm onSubmitted={refresh} />

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        {analyses === null ? (
          <p className="text-sm text-gray-500">Loading...</p>
        ) : analyses.length === 0 ? (
          <p className="text-sm text-gray-500">No repos submitted yet.</p>
        ) : (
          <ul className="divide-y divide-gray-200 rounded-md border border-gray-200">
            {analyses.map((analysis) => {
              const isExpanded = expandedId === analysis.id;
              const canExpand =
                analysis.status === "complete" || analysis.status === "failed";

              return (
                <li key={analysis.id}>
                  <div className="flex items-center justify-between gap-3 px-4 py-3">
                    <a
                      href={analysis.repo_url}
                      target="_blank"
                      rel="noreferrer"
                      className="min-w-0 truncate text-sm text-blue-600 hover:underline"
                    >
                      {analysis.repo_url}
                    </a>
                    <div className="flex shrink-0 items-center gap-2">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[analysis.status]}`}
                      >
                        {analysis.status}
                      </span>
                      {canExpand && (
                        <button
                          type="button"
                          onClick={() => toggleExpand(analysis)}
                          aria-expanded={isExpanded}
                          className={`text-xs font-medium text-gray-500 hover:text-gray-700 ${FOCUS_RING}`}
                        >
                          {isExpanded ? "Hide details ▴" : "Details ▾"}
                        </button>
                      )}
                    </div>
                  </div>

                  {isExpanded && (
                    <div className="space-y-4 border-t border-gray-100 bg-gray-50 px-4 py-4">
                      {analysis.status === "failed" && (
                        <p className="text-sm text-gray-600">
                          This analysis failed before producing a result. Check
                          the agents worker's logs for the error.
                        </p>
                      )}

                      {analysis.status === "complete" && (
                        <>
                          <div className="flex flex-wrap items-center gap-3">
                            {analysis.review_approved !== null && (
                              <span
                                className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                                  analysis.review_approved
                                    ? "bg-green-100 text-green-700"
                                    : "bg-amber-100 text-amber-700"
                                }`}
                              >
                                {analysis.review_approved
                                  ? "Review: approved"
                                  : "Review: flagged concerns"}
                              </span>
                            )}

                            {findingsState[analysis.id] === "ready" && (
                              <div className="ml-auto flex items-center gap-3 text-xs">
                                <button
                                  type="button"
                                  onClick={() => handleCopy(analysis)}
                                  className={`font-medium text-gray-500 hover:text-gray-700 ${FOCUS_RING}`}
                                >
                                  {copiedId === analysis.id
                                    ? "Copied!"
                                    : "Copy report"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleDownloadPdf(analysis)}
                                  className={`font-medium text-gray-500 hover:text-gray-700 ${FOCUS_RING}`}
                                >
                                  Download as PDF
                                </button>
                              </div>
                            )}
                          </div>

                          {analysis.proposal && (
                            <div>
                              <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                                Proposal
                              </h3>
                              <div className="rounded-md border border-gray-200 bg-white px-3 py-2">
                                <MarkdownProposal content={analysis.proposal} />
                              </div>
                            </div>
                          )}

                          <div>
                            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                              Findings
                            </h3>
                            {findingsState[analysis.id] === "loading" && (
                              <p className="text-sm text-gray-500">
                                Loading...
                              </p>
                            )}
                            {findingsState[analysis.id] === "error" && (
                              <p role="alert" className="text-sm text-red-600">
                                Failed to load findings.
                              </p>
                            )}
                            {findingsState[analysis.id] === "ready" &&
                              (findingsByAnalysis[analysis.id].length === 0 ? (
                                <p className="text-sm text-gray-500">
                                  No findings reported.
                                </p>
                              ) : (
                                <ul className="space-y-2">
                                  {findingsByAnalysis[analysis.id].map(
                                    (finding) => (
                                      <li
                                        key={finding.id}
                                        className="rounded-md border border-gray-200 bg-white px-3 py-2"
                                      >
                                        <div className="flex flex-wrap items-center gap-2">
                                          <span
                                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${SEVERITY_STYLES[finding.severity]}`}
                                          >
                                            {finding.severity}
                                          </span>
                                          <span className="text-xs text-gray-500">
                                            {finding.agent_name}
                                          </span>
                                          {finding.disputed && (
                                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                                              disputed by review
                                            </span>
                                          )}
                                        </div>
                                        <p className="mt-1 text-sm font-medium text-gray-900">
                                          {finding.title}
                                        </p>
                                        {finding.detail !== finding.title && (
                                          <p className="mt-0.5 text-sm text-gray-600">
                                            {finding.detail}
                                          </p>
                                        )}
                                      </li>
                                    ),
                                  )}
                                </ul>
                              ))}
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
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
