#!/usr/bin/env node
/**
 * Scans for secrets/sensitive files across three scopes that matter for
 * "am I about to push something bad": unpushed commits, staged changes, and
 * unstaged working-tree changes. Only scans ADDED lines in diffs (`+`, not
 * `+++`) — we care about what's being introduced, not what's already there
 * or being removed.
 *
 * Usage: node scan.mjs
 * Exit code: 0 = clean, 1 = findings.
 */
import { execSync } from "node:child_process";

// Same shapes as agents/src/lib/redact.ts, plus a few more common ones —
// keep these two lists in sync if either changes.
const SECRET_PATTERNS = [
  { name: "AWS access key ID", re: /AKIA[0-9A-Z]{16}/g },
  { name: "OpenAI/Anthropic-style secret key", re: /\bsk-[A-Za-z0-9_-]{20,}/g },
  { name: "GitHub token", re: /\bgh[pousr]_[A-Za-z0-9]{36}\b/g },
  { name: "Slack token", re: /\bxox[baprs]-[A-Za-z0-9-]{10,}/g },
  {
    name: "Private key block",
    re: /-----BEGIN (RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
  },
  {
    name: "KEY/TOKEN/SECRET assignment with a long value",
    re: /((?:API|SECRET|ACCESS|PRIVATE|CLIENT)[_-]?(?:KEY|TOKEN|SECRET)\s*[:=]\s*["']?)([A-Za-z0-9\-_/+=]{16,})/gi,
  },
];

// These files legitimately contain the pattern *definitions* as literal
// text (regex source), which would otherwise trip their own detector.
const EXCLUDED_PATHS = new Set([
  "agents/src/lib/redact.ts",
  ".claude/skills/security-check/scripts/scan.mjs",
]);

function sh(cmd) {
  try {
    return execSync(cmd, { encoding: "utf8" }).trim();
  } catch {
    return "";
  }
}

function isForbiddenEnvFile(path) {
  const base = path.split("/").pop() ?? "";
  if (base.endsWith(".example")) return false; // templates are always fine
  return base === ".env" || /^\.env\.[^.]+$/.test(base);
}

const OTHER_FORBIDDEN_FILENAME_PATTERNS = [
  /\.pem$/,
  /(^|\/)id_rsa$/,
  /(^|\/)id_ed25519$/,
  /credentials\.json$/i,
];

function isForbiddenFile(path) {
  return isForbiddenEnvFile(path) || OTHER_FORBIDDEN_FILENAME_PATTERNS.some((p) => p.test(path));
}

function findSecretsInText(text) {
  const hits = [];
  for (const { name, re } of SECRET_PATTERNS) {
    const matches = text.match(re);
    if (matches) hits.push({ name, count: matches.length });
  }
  return hits;
}

/** `scopeArgs` is whatever comes after `git diff` — "", "--cached", or a commit range. */
function scanScope(scopeLabel, scopeArgs) {
  const findings = [];
  const files = sh(`git diff ${scopeArgs} --name-only`)
    .split("\n")
    .filter(Boolean)
    .filter((f) => !EXCLUDED_PATHS.has(f));

  for (const file of files) {
    if (isForbiddenFile(file)) {
      findings.push({ scope: scopeLabel, file, issue: "forbidden file (secrets/credentials)" });
    }

    const fileDiff = sh(`git diff ${scopeArgs} -- "${file}"`);
    const addedLines = fileDiff
      .split("\n")
      .filter((line) => line.startsWith("+") && !line.startsWith("+++"))
      .map((line) => line.slice(1))
      .join("\n");

    for (const hit of findSecretsInText(addedLines)) {
      findings.push({
        scope: scopeLabel,
        file,
        issue: `possible ${hit.name} (${hit.count} match${hit.count > 1 ? "es" : ""})`,
      });
    }
  }

  return findings;
}

function getUnpushedRange() {
  const hasUpstream = sh("git rev-parse --abbrev-ref @{u} 2>/dev/null");
  if (hasUpstream) return "@{u}..HEAD";
  const hasMain = sh("git rev-parse --verify origin/main 2>/dev/null");
  return hasMain ? "origin/main..HEAD" : null;
}

function main() {
  const allFindings = [];

  const unpushedRange = getUnpushedRange();
  if (unpushedRange) {
    allFindings.push(...scanScope(`unpushed commits (${unpushedRange})`, unpushedRange));
  } else {
    console.log(
      "(no upstream and no origin/main to diff against — skipping unpushed-commit scan)",
    );
  }

  allFindings.push(...scanScope("staged", "--cached"));
  allFindings.push(...scanScope("unstaged working tree", ""));

  if (allFindings.length === 0) {
    console.log(
      "✔ No secrets or forbidden files found in unpushed commits, staged, or unstaged changes.",
    );
    process.exit(0);
  }

  console.log(`✖ ${allFindings.length} finding(s):\n`);
  for (const f of allFindings) {
    console.log(`  [${f.scope}] ${f.file} — ${f.issue}`);
  }
  console.log("\nReview each one before pushing. A real secret found in an already-committed");
  console.log("(even unpushed) commit needs the commit rewritten, not just a new commit that");
  console.log("removes it — the old value is still in history until then.");
  process.exit(1);
}

main();
