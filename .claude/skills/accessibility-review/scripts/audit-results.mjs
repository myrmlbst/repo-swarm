/**
 * Runs an axe-core scan against the dashboard's *result* states, which
 * audit.mjs can't reach (it only ever sees a freshly-queued row): the
 * collapsed list with running/complete/failed rows, the failed row's panel,
 * and a completed row expanded to show the proposal, findings (with the
 * informational group opened) and the usage table. Also checks keyboard
 * behaviour of the expand toggle and the skip link, since axe can't.
 *
 * Seeds rows for a throwaway user via ../../_shared/seed-results.mjs and
 * deletes the user (cascading every row) afterwards.
 *
 * Usage: node audit-results.mjs <webBaseUrl>
 * Exits non-zero on any serious/critical axe violation or failed manual check.
 */
import { chromium } from "playwright";
import AxeBuilder from "@axe-core/playwright";
import path from "node:path";
import fs from "node:fs";
import { getAdminClient, createThrowawayUser, loginViaUI, REPO_ROOT } from "../../_shared/session.mjs";
import { seedResultRows } from "../../_shared/seed-results.mjs";

const webBaseUrl = process.argv[2];
if (!webBaseUrl) {
  console.error("Usage: node audit-results.mjs <webBaseUrl>");
  process.exit(2);
}

const OUT_DIR = path.join(REPO_ROOT, ".claude/skills/accessibility-review/last-run");
fs.mkdirSync(OUT_DIR, { recursive: true });

let failed = false;
const report = [];

async function scan(page, label) {
  const results = await new AxeBuilder({ page }).analyze();
  report.push({ label, url: page.url(), violations: results.violations });

  console.log(`\n=== ${label} ===`);
  if (results.violations.length === 0) {
    console.log("  no violations");
    return;
  }
  for (const v of results.violations) {
    console.log(`  [${v.impact}] ${v.id}: ${v.help} (${v.nodes.length} node(s))`);
    for (const node of v.nodes) console.log(`      -> ${node.target.join(" ")}`);
    if (v.impact === "serious" || v.impact === "critical") failed = true;
  }
}

function check(name, ok, detail = "") {
  console.log(`  ${ok ? "PASS" : "FAIL"}  ${name}${detail ? ` (${detail})` : ""}`);
  if (!ok) failed = true;
}

const admin = getAdminClient();
const user = await createThrowawayUser(admin);
const browser = await chromium.launch();

try {
  await seedResultRows(admin, user.id);

  for (const vp of [
    { name: "desktop", width: 1280, height: 800 },
    { name: "mobile", width: 375, height: 812 },
  ]) {
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    await page.goto(`${webBaseUrl}/login`, { waitUntil: "networkidle" });
    await loginViaUI(page, webBaseUrl, user.email, user.password);
    await page.waitForSelector("text=Complete");

    await scan(page, `results-collapsed (${vp.name})`);

    const toggles = page.getByRole("button", { name: /details/i });

    // Rows are newest-first: running (no toggle), complete, failed.
    await toggles.nth(1).click();
    await page.waitForSelector("text=This analysis failed");
    await scan(page, `results-failed-expanded (${vp.name})`);
    await toggles.nth(1).click(); // collapse again

    await toggles.nth(0).click();
    await page.waitForSelector("text=Total cost", { timeout: 10000 });
    const info = page.getByText(/Show \d+ informational/);
    if (await info.count()) await info.first().click();
    await scan(page, `results-complete-expanded (${vp.name})`);

    if (vp.name === "desktop") {
      console.log("\n=== manual checks (desktop) ===");

      // aria-expanded / aria-controls wiring on the open toggle.
      const openToggle = page.getByRole("button", { name: /hide details/i });
      const controls = await openToggle.getAttribute("aria-controls");
      check(
        "open toggle has aria-expanded=true and aria-controls -> existing panel",
        (await openToggle.getAttribute("aria-expanded")) === "true" &&
          !!controls &&
          (await page.locator(`#${controls}`).count()) === 1,
        controls ?? "no aria-controls",
      );

      // Exactly one h1, and no skipped heading levels inside the expanded card.
      const levels = await page.$$eval("h1,h2,h3,h4,h5,h6", (hs) => hs.map((h) => Number(h.tagName[1])));
      check("exactly one <h1> on the page", levels.filter((l) => l === 1).length === 1, `h-levels: ${levels.join(",")}`);
      const skipped = levels.some((l, i) => i > 0 && l - levels[i - 1] > 1);
      check("no skipped heading levels in document order", !skipped);

      // Keyboard: the toggle is reachable and operable with Enter/Space.
      await openToggle.focus();
      await page.keyboard.press("Enter");
      check(
        "Enter on the toggle collapses the panel",
        (await page.getByRole("button", { name: /^details/i }).first().getAttribute("aria-expanded")) === "false",
      );

      // Focus ring is actually painted on keyboard focus.
      await page.keyboard.press("Tab");
      const outline = await page.evaluate(() => {
        const el = document.activeElement;
        const s = el ? getComputedStyle(el) : null;
        return s ? `${s.outlineStyle}/${s.outlineWidth}` : "none";
      });
      check("focused control shows an outline", !outline.startsWith("none"), outline);

      // Skip link: first Tab stop on a fresh load, and it lands on <main>.
      // Not "networkidle": with a run in progress the list polls every few
      // seconds by design, so the network may never settle.
      await page.goto(`${webBaseUrl}/`, { waitUntil: "domcontentloaded" });
      await page.waitForSelector("main h1");
      await page.keyboard.press("Tab");
      const firstStop = await page.evaluate(() => document.activeElement?.textContent?.trim());
      check("first Tab stop is the skip link", firstStop === "Skip to content", firstStop);
      await page.keyboard.press("Enter");
      const mainFocused = await page.evaluate(() => document.activeElement?.id === "main");
      check("skip link moves focus to <main>", mainFocused);
    }

    await page.screenshot({ path: path.join(OUT_DIR, `results-${vp.name}.png`) });
    await context.close();
  }
} finally {
  await browser.close();
  await admin.auth.admin.deleteUser(user.id);
}

fs.writeFileSync(path.join(OUT_DIR, "report-results.json"), JSON.stringify(report, null, 2));
console.log(`\nReport written to ${OUT_DIR}/report-results.json`);
process.exit(failed ? 1 : 0);
