---
name: accessibility-review
description: Automated accessibility audit and fix for the web/ frontend (axe-core + Playwright), covering /login and the authenticated dashboard. Use when asked to check, audit, or fix accessibility/a11y issues in this project, or after any change to files under web/src.
---

# Accessibility review (flyrank-capstone / web)

Audits `web/` for WCAG issues with an automated axe-core scan, fixes what it finds, and re-verifies. Also referenced by the `frontend-design` skill, which invokes this one as its final pass after visual changes.

## 1. One-time setup

```bash
cd .claude/skills && npm install
```

This installs Playwright, `@axe-core/playwright`, `@supabase/supabase-js`, and `dotenv` into `.claude/skills/node_modules` — tooling for these skills only, not a dependency of the shipped app. It lives at the `skills/` level (not inside `_shared/`) so Node's module resolution, which walks upward from the running script's directory, finds it from either skill's `scripts/` folder. **Playwright is pinned to exactly `1.40.0`** because newer Playwright releases dropped Chromium support for this machine's macOS version (13.x / "mac13"). If you're running this on a newer OS, you can bump the version in `.claude/skills/package.json` and re-run `npm install` — no code changes needed either way. Then make sure the Chromium binary is present:

```bash
npx --yes playwright@1.40.0 install chromium
```

(Skip this if it's already cached at `~/Library/Caches/ms-playwright`.)

## 2. Make sure both dev servers are running

Check first — don't blindly relaunch:

```bash
curl -sf http://localhost:3210/healthz && echo "api up"
```

If the API isn't up:

```bash
(cd api && npm run dev > /tmp/flyrank-dev.log 2>&1 &)
```

Poll (don't `sleep` blindly — see `api/.env`'s `PORT` for the actual port if you changed it):

```bash
timeout=30; until curl -sf http://localhost:3210/healthz >/dev/null || [ $timeout -le 0 ]; do sleep 1; timeout=$((timeout-1)); done
```

For the web app, check what's already running, otherwise start it on a free port (3000 may be occupied by an unrelated project on this machine — that's fine, any port works, just note which one):

```bash
(cd web && npm run dev -- -p 3100 > /tmp/flyrank-web.log 2>&1 &)
```

Poll `http://localhost:<port>/login` until it returns 200, same pattern as above. `web/.env.local` must already point `NEXT_PUBLIC_API_BASE_URL` at the running API.

## 3. Run the audit

```bash
node .claude/skills/accessibility-review/scripts/audit.mjs http://localhost:3100
```

(Replace the port with whatever the web server is actually bound to.)

This scans three states — `/login`, the dashboard with zero analyses, and the dashboard with one submitted analysis (so the status-badge and list-item markup gets covered too) — using a throwaway confirmed Supabase test user it creates and deletes itself via the service-role key in `api/.env`. Output: a violation summary on stdout, screenshots, and `report.json`, all written to `.claude/skills/accessibility-review/last-run/` (gitignored — it's scan output, not source). Exit code is non-zero if anything **serious** or **critical** was found.

Also run the results-state audit, since `audit.mjs` never expands a result card and that's where the densest markup lives (findings list, `<details>` group, usage table):

```bash
node .claude/skills/accessibility-review/scripts/audit-results.mjs http://localhost:3100
```

It seeds a running, a failed and a completed analysis for a throwaway user (via `_shared/seed-results.mjs`), runs axe on the collapsed list, the failed panel and the fully expanded completed panel at desktop and mobile widths, and also asserts what axe can't: toggle `aria-expanded`/`aria-controls` wiring, a single `<h1>` with no skipped heading levels, Enter operating the toggle, a painted focus outline, and the skip link being the first Tab stop and moving focus to `<main>`. Exit code is non-zero on any serious/critical violation or failed check.

Note axe reports text over gradients/translucent layers as `incomplete` rather than a violation — measure those by hand (sample the rendered background pixels behind the text) instead of trusting a clean scan.

## 4. Fix what it finds

For each violation in the report:

1. Open the file(s) under `web/src` that render the flagged selector (`node.target` in the report/console output).
2. Fix at the source, don't suppress the rule. Common ones in this codebase and their fix:
   - **Missing accessible name / label** — every `<input>` needs a `<label htmlFor>` (already the pattern in `LoginPage`; follow it for any new field).
   - **Color contrast** — check the flagged text/background pair against WCAG AA (4.5:1 for normal text, 3:1 for large text/UI components). Prefer darkening a `gray-400`/`gray-500` down a step over introducing a new color.
   - **Button/link with no discernible text** — icon-only controls need `aria-label`.
   - **Missing landmark/heading structure** — pages should have exactly one `<h1>` inside `<main>`.

Also apply these manual practices axe-core can't catch by itself — check them by eye against the screenshots and the component source:

- **Focus visibility**: interactive elements (`button`, `input`, `a`) must show a visible focus ring on keyboard navigation. Tailwind's preflight can suppress the browser default — if a focus check shows nothing, add `focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600` (or the project's primary color) rather than removing the reset.
- **Live regions for dynamic messages**: error/status text that appears after an async action (e.g. `LoginPage`'s error message, `SubmitRepoForm`'s error message) should carry `role="alert"` (or `aria-live="polite"` for non-error status) so screen reader users are notified without moving focus.
- **Reduced motion**: any transition/animation added later should respect `prefers-reduced-motion`.

## 5. Re-verify

Re-run step 3. Repeat 4–5 until the exit code is 0 and the console shows "no violations" for all three scanned states, or until remaining findings are false positives — if you judge one to be a false positive, say so explicitly in your summary to the user rather than silently ignoring it.

## 6. Report

Summarize: what was scanned, what was found, what was fixed, what (if anything) remains and why. Don't just say "done" — name the specific rule IDs fixed.
