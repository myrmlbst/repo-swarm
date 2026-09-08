/**
 * Golden-repo eval suite (DESIGNDOC.md § 8). For each fixture under
 * golden-repos/: scaffold it into a real local git repo, run code_agent
 * then {cloud_agent, security_agent} in parallel against it (bypassing the
 * orchestrator's LLM planning step — the eval wants a fixed, deterministic
 * agent selection, not whatever a given run's planner happens to choose),
 * collect their findings, and score precision/recall against the
 * hand-labeled expected-findings.json using an LLM judge (semantic match,
 * not exact string match).
 *
 * Usage: npm run eval (from agents/)
 */
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import { codeAgent } from "../src/agents/codeAgent";
import { cloudAgent } from "../src/agents/cloudAgent";
import { securityAgent } from "../src/agents/securityAgent";
import { withScaffoldedRepo } from "./lib/scaffoldRepo";
import { scoreFindings, type JudgeResult } from "./lib/judge";
import type { AgentContext, CodeFacts, Finding } from "../src/types";

const GOLDEN_REPOS_DIR = join(__dirname, "golden-repos");
const QUESTION = "Review this application for production security risks and deployment readiness issues.";

interface GoldenRepoResult {
  name: string;
  expected: string[];
  actual: string[];
  judge: JudgeResult;
}

async function runOneGoldenRepo(dirName: string): Promise<GoldenRepoResult> {
  const dir = join(GOLDEN_REPOS_DIR, dirName);
  const expectedRaw = await readFile(join(dir, "expected-findings.json"), "utf-8");
  const expected: string[] = JSON.parse(expectedRaw).findings;

  const actual = await withScaffoldedRepo(join(dir, "files"), async (repoPath) => {
    const request = { repoUrl: repoPath, question: QUESTION };

    const codeContext: AgentContext = { request, task: QUESTION, priorResults: [] };
    const codeResult = await codeAgent.run(codeContext);

    const downstreamContext: AgentContext = {
      request,
      task: QUESTION,
      priorResults: [codeResult],
    };
    const [cloudResult, securityResult] = await Promise.all([
      cloudAgent.run(downstreamContext),
      securityAgent.run(downstreamContext),
    ]);

    const codeFacts = codeResult.data as CodeFacts;
    const findings: Finding[] = [
      ...((cloudResult.data as { findings: Finding[] }).findings ?? []),
      ...((securityResult.data as { findings: Finding[] }).findings ?? []),
      // code_agent's own "issues" list is where redacted-secret and
      // missing-containerization findings actually land (it doesn't
      // produce Finding objects, just strings) — fold them in too.
      ...codeFacts.issues.map((issue): Finding => ({ title: issue, detail: issue, severity: "info" })),
    ];

    return findings.map((f) => `${f.title}: ${f.detail}`);
  });

  const judge = await scoreFindings(expected, actual);
  return { name: dirName, expected, actual, judge };
}

function printResult(result: GoldenRepoResult): void {
  const { name, judge } = result;
  console.log(`\n=== ${name} ===`);
  console.log(`  recall:    ${judge.matchedExpectedCount}/${judge.totalExpected} (${(judge.recall * 100).toFixed(0)}%)`);
  console.log(`  precision: ${judge.supportedActualCount}/${judge.totalActual} (${(judge.precision * 100).toFixed(0)}%)`);
  if (judge.unmatchedExpected.length > 0) {
    console.log("  missed:");
    for (const f of judge.unmatchedExpected) console.log(`    - ${f}`);
  }
  if (judge.unsupportedActual.length > 0) {
    console.log("  unsupported (not in expected list):");
    for (const f of judge.unsupportedActual) console.log(`    - ${f}`);
  }
}

async function main() {
  const entries = await readdir(GOLDEN_REPOS_DIR, { withFileTypes: true });
  const repoDirs = entries.filter((e) => e.isDirectory()).map((e) => e.name).sort();

  console.log(`Running ${repoDirs.length} golden repos...`);

  const results: GoldenRepoResult[] = [];
  for (const dirName of repoDirs) {
    const result = await runOneGoldenRepo(dirName);
    printResult(result);
    results.push(result);
  }

  const totalExpected = results.reduce((sum, r) => sum + r.judge.totalExpected, 0);
  const totalMatched = results.reduce((sum, r) => sum + r.judge.matchedExpectedCount, 0);
  const totalActual = results.reduce((sum, r) => sum + r.judge.totalActual, 0);
  const totalSupported = results.reduce((sum, r) => sum + r.judge.supportedActualCount, 0);

  const aggregateRecall = totalMatched / totalExpected;
  const aggregatePrecision = totalActual > 0 ? totalSupported / totalActual : 1;

  console.log("\n=== Aggregate ===");
  console.log(`  recall:    ${totalMatched}/${totalExpected} (${(aggregateRecall * 100).toFixed(0)}%)`);
  console.log(`  precision: ${totalSupported}/${totalActual} (${(aggregatePrecision * 100).toFixed(0)}%)`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
