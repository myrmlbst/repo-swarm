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
import { FOCUS_RING } from "@/lib/styles";

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

  return (
    <div className="space-y-6">
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

                        {analysis.proposal && (
                          <div>
                            <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                              Proposal
                            </h3>
                            <p className="whitespace-pre-wrap text-sm text-gray-800">
                              {analysis.proposal}
                            </p>
                          </div>
                        )}

                        <div>
                          <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-gray-500">
                            Findings
                          </h3>
                          {findingsState[analysis.id] === "loading" && (
                            <p className="text-sm text-gray-500">Loading...</p>
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
  );
}
