"use client";

import { useState, type FormEvent } from "react";
import { createClient } from "@/lib/supabase/client";
import { createAnalysis } from "@/lib/api";
import { FOCUS_RING } from "@/lib/styles";

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
        setError("Your session expired — refresh the page.");
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
    <form onSubmit={handleSubmit} className="space-y-2">
      <div className="flex gap-2">
        <label htmlFor="repo-url" className="sr-only">
          Repository URL
        </label>
        <input
          id="repo-url"
          type="url"
          required
          placeholder="https://github.com/owner/repo"
          value={repoUrl}
          onChange={(e) => setRepoUrl(e.target.value)}
          className={`flex-1 rounded-md border border-gray-300 px-3 py-2 text-sm ${FOCUS_RING}`}
        />
        <button
          type="submit"
          disabled={loading}
          className={`rounded-md bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-600 disabled:opacity-50 ${FOCUS_RING}`}
        >
          {loading ? "Submitting..." : "Submit"}
        </button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-red-600">
          {error}
        </p>
      )}
    </form>
  );
}
