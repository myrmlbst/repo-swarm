"use client";

import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { listAnalyses, type Analysis } from "@/lib/api";
import { SubmitRepoForm } from "./SubmitRepoForm";

const STATUS_STYLES: Record<Analysis["status"], string> = {
  queued: "bg-gray-100 text-gray-700",
  running: "bg-blue-100 text-blue-700",
  complete: "bg-green-100 text-green-700",
  failed: "bg-red-100 text-red-700",
};

export function AnalysesList() {
  const [analyses, setAnalyses] = useState<Analysis[] | null>(null);
  const [error, setError] = useState<string | null>(null);

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

  return (
    <div className="space-y-6">
      <SubmitRepoForm onSubmitted={refresh} />

      {error && <p className="text-sm text-red-600">{error}</p>}

      {analyses === null ? (
        <p className="text-sm text-gray-500">Loading...</p>
      ) : analyses.length === 0 ? (
        <p className="text-sm text-gray-500">No repos submitted yet.</p>
      ) : (
        <ul className="divide-y divide-gray-200 rounded-md border border-gray-200">
          {analyses.map((analysis) => (
            <li
              key={analysis.id}
              className="flex items-center justify-between px-4 py-3"
            >
              <a
                href={analysis.repo_url}
                target="_blank"
                rel="noreferrer"
                className="text-sm text-blue-600 hover:underline"
              >
                {analysis.repo_url}
              </a>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[analysis.status]}`}
              >
                {analysis.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
