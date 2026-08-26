/**
 * Screenshots every route of the web app at mobile and desktop widths, both
 * logged out and logged in (via a throwaway confirmed Supabase user), for
 * visual design review against .claude/skills/frontend-design/references/design-system.md.
 *
 * Usage: node screenshot-pages.mjs <webBaseUrl>
 * Example: node screenshot-pages.mjs http://localhost:3100
 */
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { getAdminClient, createThrowawayUser, loginViaUI, REPO_ROOT } from "../../_shared/session.mjs";

const webBaseUrl = process.argv[2];
if (!webBaseUrl) {
  console.error("Usage: node screenshot-pages.mjs <webBaseUrl>");
  process.exit(2);
}

const OUT_DIR = path.join(REPO_ROOT, ".claude/skills/frontend-design/last-run");
fs.mkdirSync(OUT_DIR, { recursive: true });

const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "desktop", width: 1280, height: 800 },
];

async function shot(page, label) {
  const file = path.join(OUT_DIR, `${label}.png`);
  await page.screenshot({ path: file, fullPage: true });
  console.log("  wrote", file);
}

const admin = getAdminClient();
const user = await createThrowawayUser(admin);
const browser = await chromium.launch();

try {
  for (const vp of VIEWPORTS) {
    console.log(`\n--- ${vp.name} (${vp.width}x${vp.height}) ---`);
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();

    await page.goto(`${webBaseUrl}/login`, { waitUntil: "networkidle" });
    await shot(page, `login-${vp.name}`);

    await loginViaUI(page, webBaseUrl, user.email, user.password);
    await shot(page, `dashboard-empty-${vp.name}`);

    await page.fill("input[type=url]", "https://github.com/octocat/Hello-World");
    await page.click('button:has-text("Submit")');
    await page.waitForSelector("text=queued", { timeout: 10000 });
    await shot(page, `dashboard-with-analysis-${vp.name}`);

    await context.close();
  }
} finally {
  await browser.close();
  await admin.auth.admin.deleteUser(user.id);
}

console.log(`\nAll screenshots written to ${OUT_DIR}`);
console.log("Read each one (Read tool) and compare against references/design-system.md before making changes.");
