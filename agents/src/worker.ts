/**
 * Long-running queue consumer: pops analysis IDs pushed by
 * api/src/routes/analyses.ts, runs the orchestrator against each, and
 * persists the result (DESIGNDOC.md § 9 — agent workers run separately from
 * the API, scaling independently; this is that process). Polling rather
 * than a blocking pop — simpler and more predictable over Upstash's REST
 * API than relying on long-poll semantics.
 *
 * Usage: npm run worker
 */
import { redis } from "./lib/redisClient";
import { supabaseAdmin } from "./lib/supabaseAdmin";
import { runOrchestrator } from "./orchestrator";
import { estimateCostUsd } from "./lib/pricing";
import { env } from "./env";
import type {
  AgentResult,
  ArchitectureProposal,
  CodeFacts,
  ReviewCritique,
  SecurityFindings,
  Severity,
} from "./types";

// Must match the key api/src/routes/analyses.ts pushes onto — the two
// packages don't share code, so this is duplicated by name, not import.
const QUEUE_KEY = "analysis_queue";
const POLL_INTERVAL_MS = 2000;

const DEFAULT_QUESTION =
  "Review this application and propose a secure, production-ready AWS deployment " +
  "architecture. Identify concrete security risks and deployment-readiness issues.";

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface FindingRow {
  analysis_id: string;
  agent_name: string;
  severity: Severity;
  title: string;
  detail: string;
  source_refs: string[];
  disputed: boolean;
}

/**
 * Flattens every agent's structured output into findings rows. code_agent's
 * "issues" (each with its own optional sourcePath) and review_agent's
 * "disputed" claims (their own rows, not retroactively flagging an existing
 * one — see 0004_analysis_results.sql) are folded in alongside
 * cloud/security/architecture's structured Finding[] arrays, whose
 * `sources` populates the same source_refs column.
 */
function findingsFromResults(
  analysisId: string,
  results: AgentResult[],
): FindingRow[] {
  const rows: FindingRow[] = [];
  const base = (agentName: string, sourceRefs: string[]) => ({
    analysis_id: analysisId,
    agent_name: agentName,
    source_refs: sourceRefs,
  });

  for (const result of results) {
    if (result.agent === "code_agent") {
      const facts = result.data as CodeFacts;
      for (const issue of facts.issues) {
        rows.push({
          ...base(result.agent, issue.sourcePath ? [issue.sourcePath] : []),
          severity: "info",
          title: issue.description,
          detail: issue.description,
          disputed: false,
        });
      }
    } else if (
      result.agent === "cloud_agent" ||
      result.agent === "architecture_agent"
    ) {
      const data = result.data as ArchitectureProposal;
      for (const f of data.findings) {
        rows.push({
          ...base(result.agent, f.sources),
          severity: f.severity,
          title: f.title,
          detail: f.detail,
          disputed: false,
        });
      }
    } else if (result.agent === "security_agent") {
      const data = result.data as SecurityFindings;
      for (const f of data.findings) {
        rows.push({
          ...base(result.agent, f.sources),
          severity: f.severity,
          title: f.title,
          detail: f.detail,
          disputed: false,
        });
      }
    } else if (result.agent === "review_agent") {
      const data = result.data as ReviewCritique;
      for (const d of data.disputed) {
        rows.push({
          ...base(result.agent, []),
          severity: "info",
          title: d.claim,
          detail: d.reason,
          disputed: true,
        });
      }
    }
  }

  return rows;
}

async function processAnalysis(analysisId: string): Promise<void> {
  console.log(`[worker] processing analysis ${analysisId}`);

  const { data: analysis, error: fetchError } = await supabaseAdmin
    .from("analyses")
    .select("id, repo_url")
    .eq("id", analysisId)
    .maybeSingle();

  if (fetchError || !analysis) {
    console.error(
      `[worker] could not load analysis ${analysisId}:`,
      fetchError?.message,
    );
    return;
  }

  await supabaseAdmin
    .from("analyses")
    .update({ status: "running" })
    .eq("id", analysisId);

  try {
    const { results, runs } = await runOrchestrator({
      repoUrl: analysis.repo_url,
      question: DEFAULT_QUESTION,
    });

    const architectureResult = results.find(
      (r) => r.agent === "architecture_agent",
    );
    const reviewResult = results.find((r) => r.agent === "review_agent");

    const proposal = architectureResult
      ? (architectureResult.data as ArchitectureProposal).proposal
      : null;
    const reviewApproved = reviewResult
      ? (reviewResult.data as ReviewCritique).approved
      : null;

    const findingRows = findingsFromResults(analysisId, results);
    if (findingRows.length > 0) {
      const { error } = await supabaseAdmin
        .from("findings")
        .insert(findingRows);
      if (error)
        console.error(`[worker] failed to insert findings:`, error.message);
    }

    const runRows = runs.map((r) => {
      const tokensUsed = r.usage
        ? r.usage.inputTokens + r.usage.outputTokens
        : null;
      const costUsd = r.usage
        ? estimateCostUsd(
            env.ANTHROPIC_MODEL,
            r.usage.inputTokens,
            r.usage.outputTokens,
          )
        : null;

      return {
        analysis_id: analysisId,
        agent_name: r.agent,
        status: "complete" as const,
        started_at: r.startedAt,
        finished_at: r.finishedAt,
        tokens_used: tokensUsed,
        cost_usd: costUsd,
        retrieval_count: r.retrievalCount ?? null,
      };
    });
    if (runRows.length > 0) {
      const { error } = await supabaseAdmin
        .from("analysis_runs")
        .insert(runRows);
      if (error)
        console.error(
          `[worker] failed to insert analysis_runs:`,
          error.message,
        );
    }

    await supabaseAdmin
      .from("analyses")
      .update({
        status: "complete",
        completed_at: new Date().toISOString(),
        proposal,
        review_approved: reviewApproved,
      })
      .eq("id", analysisId);

    console.log(`[worker] completed analysis ${analysisId}`);
  } catch (error) {
    console.error(`[worker] analysis ${analysisId} failed:`, error);
    await supabaseAdmin
      .from("analyses")
      .update({ status: "failed", completed_at: new Date().toISOString() })
      .eq("id", analysisId);
  }
}

async function main(): Promise<void> {
  console.log(
    `[worker] started, polling "${QUEUE_KEY}" every ${POLL_INTERVAL_MS}ms`,
  );

  for (;;) {
    const analysisId = await redis.rpop<string>(QUEUE_KEY);
    if (!analysisId) {
      await sleep(POLL_INTERVAL_MS);
      continue;
    }
    await processAnalysis(analysisId);
  }
}

main().catch((error) => {
  console.error("[worker] fatal error:", error);
  process.exit(1);
});
