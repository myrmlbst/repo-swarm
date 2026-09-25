import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";

const envText = readFileSync(new URL("./.env", import.meta.url), "utf8");
const env = {};
for (const line of envText.split("\n")) {
  const m = line.match(/^([A-Z_]+)=(.*)$/);
  if (m) env[m[1]] = m[2];
}

const admin = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const { data: latest, error } = await admin
  .from("analyses")
  .select("id, repo_url, status, created_at")
  .order("created_at", { ascending: false })
  .limit(1)
  .maybeSingle();

if (error || !latest) {
  console.log("POLL_ERROR", error?.message ?? "no rows");
  process.exit(1);
}

const id = latest.id;
console.log(`Watching analysis ${id} (${latest.repo_url}), status=${latest.status}`);

for (let i = 0; i < 120; i++) {
  const { data: row } = await admin
    .from("analyses")
    .select("status, completed_at, review_approved")
    .eq("id", id)
    .maybeSingle();

  if (row && (row.status === "complete" || row.status === "failed")) {
    console.log(`DONE status=${row.status} completed_at=${row.completed_at}`);
    if (row.status === "complete") {
      const { data: runs } = await admin
        .from("analysis_runs")
        .select("agent_name, started_at, finished_at, tokens_used, cost_usd")
        .eq("analysis_id", id)
        .order("started_at", { ascending: true });
      console.log("RUNS", JSON.stringify(runs));
    }
    process.exit(0);
  }
  await new Promise((r) => setTimeout(r, 3000));
}
console.log("TIMED_OUT still not terminal after 6 minutes");
