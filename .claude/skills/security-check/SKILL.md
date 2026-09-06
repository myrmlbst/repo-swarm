---
name: security-check
description: Scans for secrets and forbidden files (real .env files, private keys, credential files) before you push — covers unpushed commits, staged changes, and unstaged working-tree changes. Use when asked to check if it's safe to push, scan for secrets/sensitive data, or do a security check before pushing, or proactively before any push in this repo.
---

# Security check (repo-swarm)

A pre-push safety net: catches a real credential or a real `.env` file before it reaches GitHub, not after.

## 1. Run the scan

```bash
node .claude/skills/security-check/scripts/scan.mjs
```

This checks three scopes and reports which one each finding is in:

- **Unpushed commits** — whatever's on this branch but not yet on its remote tracking branch (`@{u}..HEAD`), or `origin/main..HEAD` if there's no upstream yet. This is what `git push` would actually send.
- **Staged** — `git diff --cached`, i.e. what the next commit would contain.
- **Unstaged working tree** — everything else not yet staged.

It only scans **added** lines (`+`, not context or removed lines) — the concern is what's being introduced, not what's already there.

What it flags:

- Forbidden filenames: a real `.env`/`.env.<anything>` (anything ending `.example` is exempt — that's the template convention this repo uses), `.pem`, `id_rsa`, `id_ed25519`, `credentials.json`.
- Secret-shaped content: AWS access key IDs, OpenAI/Anthropic-style `sk-` keys, GitHub tokens, Slack tokens, PEM private key blocks, and generic `*_KEY=`/`*_TOKEN=`/`*_SECRET=` assignments with a long value — the same shapes `agents/src/lib/redact.ts` already redacts from repo content the Code Agent ingests. If you add a new pattern to one, add it to the other.

Exit code 0 = clean, 1 = findings to review. `agents/src/lib/redact.ts` and the scanner script itself are excluded from the scan — they legitimately contain these patterns as regex source, not real secrets.

## 2. Triage findings

- **A real secret** (an actual key/token value, not a placeholder like `your-anthropic-api-key`): if it's only staged or unstaged, just remove it and re-run. If it's in an **unpushed commit**, don't just delete it in a new commit — the value is still in that commit's history even after you remove it in a later one. Rewrite history instead (`git commit --amend` if it's the last commit, or `git rebase -i` further back), then re-run this scan to confirm the range is clean. If it's already been pushed, treat the credential as compromised — rotate it — regardless of what you do to history afterward.
- **A false positive** (e.g. a long non-secret token-shaped string, a placeholder that happens to be 16+ chars, test fixture data): say so explicitly and explain why, don't silently ignore it. If it's a recurring false positive from a specific file, consider adding that path to `EXCLUDED_PATHS` in `scan.mjs` — same pattern as `redact.ts`'s existing exclusion — rather than re-litigating it every run.

## 3. Report

State clearly: clean, or what was found and what you did about it (fixed / rewrote history / confirmed false positive). Don't just say "looks fine" without having actually run the scan.
