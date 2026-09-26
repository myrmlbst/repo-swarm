import type { AgentRun } from "@/lib/api";
import {
  agentLabel,
  elapsedMs,
  formatCount,
  formatDuration,
  formatUsd,
} from "@/lib/format";

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-3 shadow-sm">
      <dt className="text-xs text-gray-600">{label}</dt>
      <dd className="mt-0.5 text-base font-semibold tabular-nums text-gray-900 sm:text-lg">
        {value}
      </dd>
    </div>
  );
}

/** A null tokens/cost means the agent made no LLM call (a cache hit), not "free". */
function Cached() {
  return <span className="text-gray-600 italic">cached</span>;
}

export function UsageSummary({
  runs,
  totalElapsedMs,
}: {
  runs: AgentRun[];
  totalElapsedMs: number | null;
}) {
  const totalTokens = runs.reduce((sum, r) => sum + (r.tokens_used ?? 0), 0);
  const totalCost = runs.reduce((sum, r) => sum + (r.cost_usd ?? 0), 0);

  return (
    <div className="space-y-3">
      <dl className="grid grid-cols-3 gap-2 sm:gap-3">
        <Stat label="Total cost" value={formatUsd(totalCost)} />
        <Stat label="Tokens" value={formatCount(totalTokens)} />
        <Stat
          label="Elapsed"
          value={
            totalElapsedMs === null ? "n/a" : formatDuration(totalElapsedMs)
          }
        />
      </dl>

      <div className="overflow-x-auto rounded-lg border border-gray-200 bg-white shadow-sm">
        <table className="w-full min-w-72 text-left text-[13px] sm:text-sm">
          <caption className="sr-only">
            Time, tokens and cost for each agent in this analysis
          </caption>
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50 text-xs text-gray-600">
              <th scope="col" className="px-2 py-2 sm:px-3 font-medium">
                Agent
              </th>
              <th
                scope="col"
                className="px-2 py-2 sm:px-3 text-right font-medium"
              >
                Time
              </th>
              <th
                scope="col"
                className="px-2 py-2 sm:px-3 text-right font-medium"
              >
                Tokens
              </th>
              <th
                scope="col"
                className="px-2 py-2 sm:px-3 text-right font-medium"
              >
                Cost
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {runs.map((run) => (
              <tr key={run.id}>
                <th
                  scope="row"
                  className="px-2 py-2 sm:px-3 text-left font-medium text-gray-900"
                >
                  {agentLabel(run.agent_name)}
                  {run.status === "failed" && (
                    <span className="mt-0.5 block text-xs font-normal text-red-700">
                      Failed{run.error ? `: ${run.error}` : ""}
                    </span>
                  )}
                </th>
                <td className="px-2 py-2 sm:px-3 text-right text-gray-700 tabular-nums">
                  {formatDuration(elapsedMs(run.started_at, run.finished_at))}
                </td>
                <td className="px-2 py-2 sm:px-3 text-right text-gray-700 tabular-nums">
                  {run.tokens_used === null ? (
                    run.status === "failed" ? (
                      "—"
                    ) : (
                      <Cached />
                    )
                  ) : (
                    formatCount(run.tokens_used)
                  )}
                </td>
                <td className="px-2 py-2 sm:px-3 text-right text-gray-700 tabular-nums">
                  {run.cost_usd === null ? (
                    run.status === "failed" ? (
                      "—"
                    ) : (
                      <Cached />
                    )
                  ) : (
                    formatUsd(run.cost_usd)
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
