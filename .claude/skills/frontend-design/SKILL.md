---
name: frontend-design
description: Automated visual design audit and fix for the web/ frontend — screenshots every page at mobile and desktop widths, checks against this project's design conventions, fixes inconsistencies, then runs the accessibility-review skill as a final pass. Use when asked to review, polish, or fix the design/UI/visual consistency of this project, or after adding/changing a page or component in web/src.
---

# Frontend design review (flyrank-capstone / web)

Audits `web/` for visual consistency against [references/design-system.md](references/design-system.md) — the project's actual design conventions, derived from what's already built (colors, type scale, spacing, component patterns). Ends by invoking the `accessibility-review` skill, since a visual fix (a moved element, a new focus style, a color swap) can just as easily break accessibility as improve it — don't skip that step.

## 1. One-time setup

Same shared tooling as `accessibility-review`:

```bash
cd .claude/skills && npm install
npx --yes playwright@1.40.0 install chromium
```

See that skill's SKILL.md § 1 for why Playwright is pinned to `1.40.0` on this machine.

## 2. Make sure both dev servers are running

Identical to `accessibility-review` skill's § 2 — check before starting, poll instead of sleeping:

```bash
curl -sf http://localhost:3210/healthz && echo "api up"
(cd api && npm run dev > /tmp/flyrank-dev.log 2>&1 &)   # only if not already up
(cd web && npm run dev -- -p 3100 > /tmp/flyrank-web.log 2>&1 &)   # only if not already up
```

## 3. Read the conventions first

Read [references/design-system.md](references/design-system.md) before looking at any screenshot — you need the tokens (colors, type scale, spacing, component patterns) in mind to spot a deviation, not after.

## 4. Screenshot every page

```bash
node .claude/skills/frontend-design/scripts/screenshot-pages.mjs http://localhost:3100
```

(Replace the port with whatever the web server is actually bound to.) This captures `/login`, the empty dashboard, and the dashboard with one submitted analysis — each at a 375px mobile width and a 1280px desktop width — using a throwaway confirmed Supabase test user it creates and deletes itself. Output goes to `.claude/skills/frontend-design/last-run/` (gitignored — it's scan output, not source).

**Look at every screenshot with the Read tool.** A script that "ran successfully" proves nothing about the actual visual output — you have to look.

## 5. Compare against the conventions and fix

For each screenshot, check the four things listed at the bottom of `design-system.md`: off-token values, uneven spacing, missing interactive states, mobile layout breakage. When you find a deviation:

1. Fix it in the component under `web/src`, reusing an existing class pattern from the conventions doc rather than inventing a new one.
2. If nothing in the doc fits and a new pattern is genuinely warranted, add it to `design-system.md` in the same change — don't let the doc drift out of sync with the code.

## 6. Re-verify

Re-run step 4 and re-read the new screenshots. Repeat until nothing on the checklist is left, or until you've explicitly decided a "violation" is intentional (say so in the final summary, don't just drop it silently).

## 7. Run the accessibility skill

Once the visual pass is clean, invoke the `accessibility-review` skill (via the `Skill` tool) to catch anything the design changes broke or introduced — a new color pairing can fail contrast, a restyled button can lose its focus ring, a moved element can break heading order. Don't consider this skill done until that pass is clean too.

## 8. Report

Summarize: what was screenshotted, what deviations were found and fixed (reference the specific convention from `design-system.md`), and the accessibility-review skill's outcome from step 7.
