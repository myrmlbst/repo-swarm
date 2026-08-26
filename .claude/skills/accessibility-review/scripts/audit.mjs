/**
 * Runs an axe-core accessibility scan against the given routes of the web app.
 * Public routes are scanned as-is; "/" is scanned both logged out (redirects
 * to /login, so it's really just /login again) and logged in via a throwaway
 * confirmed test user, since the dashboard's real markup only exists once
 * there's a session and at least one submitted analysis.
 *
 * Usage: node audit.mjs <webBaseUrl>
 * Example: node audit.mjs http://localhost:3100
 *
 * Exits non-zero if any "serious" or "critical" impact violations are found.
 */
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import fs from "node:fs";
import { withLoggedInPage, REPO_ROOT } from "../../_shared/session.mjs";

const webBaseUrl = process.argv[2];
if (!webBaseUrl) {
  console.error("Usage: node audit.mjs <webBaseUrl>");
  process.exit(2);
}

const OUT_DIR = path.join(REPO_ROOT, ".claude/skills/accessibility-review/last-run");
fs.mkdirSync(OUT_DIR, { recursive: true });

let hadSeriousViolation = false;
const report = [];

async function scan(page, label) {
  const results = await new AxeBuilder({ page }).analyze();
  await page.screenshot({ path: path.join(OUT_DIR, `${label}.png`), fullPage: true });

  const entry = { label, url: page.url(), violations: results.violations };
  report.push(entry);

  console.log(`\n=== ${label} (${page.url()}) ===`);
  if (results.violations.length === 0) {
    console.log("  no violations");
    return;
  }
  for (const v of results.violations) {
    console.log(`  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))`);
    for (const node of v.nodes) {
      console.log(`      -> ${node.target.join(" ")}`);
    }
    if (v.impact === "serious" || v.impact === "critical") {
      hadSeriousViolation = true;
    }
  }
}

// Logged-out routes
const browser = await chromium.launch();
const context = await browser.newContext();
const page = await context.newPage();
await page.goto(`${webBaseUrl}/login`, { waitUntil: "networkidle" });
await scan(page, "login");
await browser.close();

// Logged-in routes (dashboard empty state, then with one analysis so the
// list-item markup and status badge get scanned too)
await withLoggedInPage({ webBaseUrl }, async (loggedInPage) => {
  await scan(loggedInPage, "dashboard-empty");

  await loggedInPage.fill("input[type=url]", "https://github.com/octocat/Hello-World");
  await loggedInPage.click('button:has-text("Submit")');
  await loggedInPage.waitForSelector("text=queued", { timeout: 10000 });
  await scan(loggedInPage, "dashboard-with-analysis");
});

fs.writeFileSync(path.join(OUT_DIR, "report.json"), JSON.stringify(report, null, 2));
console.log(`\nFull report + screenshots written to ${OUT_DIR}`);

process.exit(hadSeriousViolation ? 1 : 0);
