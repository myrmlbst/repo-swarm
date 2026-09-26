"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { createAnalysis } from "@/lib/api";
import { FOCUS_RING } from "@/lib/styles";
import { AlertCircleIcon, GitHubIcon, SpinnerIcon } from "./icons";

export function SubmitRepoForm({ onSubmitted }: { onSubmitted: () => void }) {
  const [repoUrl, setRepoUrl] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const supabase = createClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError("Your session expired. Refresh the page and sign in again.");
        return;
      }

      await createAnalysis(session.access_token, repoUrl);
      setRepoUrl("");
      onSubmitted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to submit repo");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5"
    >
      <label
        htmlFor="repo-url"
        className="block text-sm font-semibold text-gray-900"
      >
        GitHub repository URL
      </label>
      <p id="repo-url-hint" className="mt-0.5 text-sm text-gray-600">
        Public repositories only. A review usually takes 1 to 2 minutes.
      </p>

      <div className="mt-3 flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <GitHubIcon className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-gray-500" />
          <input
            id="repo-url"
            type="url"
            inputMode="url"
            autoComplete="off"
            spellCheck={false}
            required
            placeholder="https://github.com/owner/repo"
            value={repoUrl}
            onChange={(e) => setRepoUrl(e.target.value)}
            aria-describedby={
              error ? "repo-url-hint repo-url-error" : "repo-url-hint"
            }
            aria-invalid={error ? true : undefined}
            className={`h-11 w-full rounded-lg border border-gray-300 bg-white pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-500 hover:border-gray-400 ${FOCUS_RING}`}
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className={`inline-flex h-11 items-center justify-center gap-2 rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white shadow-sm hover:bg-blue-600 active:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-60 ${FOCUS_RING}`}
        >
          {loading && <SpinnerIcon className="size-4 animate-spin" />}
          {loading ? "Submitting..." : "Submit repo"}
        </button>
      </div>

      {error && (
        <p
          id="repo-url-error"
          role="alert"
          className="mt-3 flex items-start gap-2 text-sm text-red-700"
        >
          <AlertCircleIcon className="mt-0.5 size-4 shrink-0" />
          {error}
        </p>
      )}
    </form>
  );
}
