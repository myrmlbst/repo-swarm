/**
 * Seeds the dashboard's "result" states for a throwaway user, shared by the
 * frontend-design screenshot script and the accessibility-review results
 * audit: one completed analysis (proposal + findings + per-agent usage,
 * copied from a real completed analysis in the project when there is one),
 * one failed, one running. Deleting the user cascades to every row seeded.
 */

const SAMPLE = {
  repo_url: "https://github.com/octocat/Hello-World",
  proposal:
    "Hello-World is a tiny static repository with no server, database or build step.\n\nProposed architecture:\n- **S3 + CloudFront** serve the files over HTTPS with Origin Access Control.\n- **GitHub Actions** syncs the repo to S3 on push and invalidates the cache.\n- **IAM** uses a narrowly scoped deploy role.\n\nNo compute, database or cache tier is needed.",
  findings: [
    { agent_name: "security_agent", severity: "critical", title: "Hardcoded API key in source", detail: "A live-looking credential is committed in index.js.", source_refs: ["index.js"], disputed: false },
    { agent_name: "cloud_agent", severity: "warn", title: "No CI/CD pipeline", detail: "Deployments are manual, so releases are not reproducible.", source_refs: [], disputed: false },
    { agent_name: "architecture_agent", severity: "info", title: "Static hosting fits this stack", detail: "Avoid provisioning backend infrastructure that does not apply.", source_refs: ["ecs-fargate.md", "rds.md"], disputed: false },
  ],
  runs: [
    { agent_name: "orchestrator", tokens_used: 1570, cost_usd: 0.006172, secs: 4.8 },
    { agent_name: "code_agent", tokens_used: null, cost_usd: null, secs: 0.9 },
    { agent_name: "cloud_agent", tokens_used: 7225, cost_usd: 0.033674, secs: 29.1 },
    { agent_name: "security_agent", tokens_used: 4384, cost_usd: 0.013864, secs: 10.3 },
    { agent_name: "architecture_agent", tokens_used: 7432, cost_usd: 0.035376, secs: 24.2 },
    { agent_name: "review_agent", tokens_used: 4724, cost_usd: 0.009904, secs: 2.1 },
  ],
};


/** Prefer a real completed analysis from the project as the template. */
async function loadTemplate(admin) {
  const { data: a } = await admin
    .from("analyses")
    .select("id, repo_url, proposal, review_approved")
    .eq("status", "complete")
    .not("proposal", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!a) return { ...SAMPLE, review_approved: true };

  const { data: findings } = await admin
    .from("findings")
    .select("agent_name, severity, title, detail, source_refs, disputed")
    .eq("analysis_id", a.id)
    .order("created_at");
  const { data: runs } = await admin
    .from("analysis_runs")
    .select("agent_name, tokens_used, cost_usd, started_at, finished_at")
    .eq("analysis_id", a.id)
    .order("started_at");

  return {
    repo_url: a.repo_url,
    proposal: a.proposal,
    review_approved: a.review_approved ?? true,
    findings: findings?.length ? findings : SAMPLE.findings,
    runs: runs?.length
      ? runs.map((r) => ({
          agent_name: r.agent_name,
          tokens_used: r.tokens_used,
          cost_usd: r.cost_usd,
          secs: (new Date(r.finished_at) - new Date(r.started_at)) / 1000,
        }))
      : SAMPLE.runs,
  };
}

async function seed(admin, userId, t) {
  const now = Date.now();
  const iso = (msAgo) => new Date(now - msAgo).toISOString();

  const { data: complete, error } = await admin
    .from("analyses")
    .insert({
      user_id: userId,
      repo_url: t.repo_url,
      status: "complete",
      proposal: t.proposal,
      review_approved: t.review_approved,
      created_at: iso(42 * 60_000),
      completed_at: iso(42 * 60_000 - 102_000),
    })
    .select("id")
    .single();
  if (error) throw error;

  await admin.from("findings").insert(t.findings.map((f) => ({ ...f, analysis_id: complete.id })));

  let cursor = now - 42 * 60_000;
  await admin.from("analysis_runs").insert(
    t.runs.map((r) => {
      const started = new Date(cursor).toISOString();
      cursor += Math.round(r.secs * 1000);
      return {
        analysis_id: complete.id,
        agent_name: r.agent_name,
        status: "complete",
        tokens_used: r.tokens_used,
        cost_usd: r.cost_usd,
        started_at: started,
        finished_at: new Date(cursor).toISOString(),
      };
    }),
  );

  await admin.from("analyses").insert([
    { user_id: userId, repo_url: "https://github.com/vercel/next.js", status: "failed", created_at: iso(3 * 60 * 60_000), completed_at: iso(3 * 60 * 60_000 - 3_000) },
    { user_id: userId, repo_url: "https://github.com/facebook/react", status: "running", created_at: iso(20_000) },
  ]);
}

/** @param {import("@supabase/supabase-js").SupabaseClient} admin */
export async function seedResultRows(admin, userId) {
  await seed(admin, userId, await loadTemplate(admin));
}
