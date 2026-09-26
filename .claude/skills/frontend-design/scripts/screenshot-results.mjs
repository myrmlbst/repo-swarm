/**
 * Screenshots the dashboard's *result* states, which screenshot-pages.mjs
 * can't reach (it only ever sees a freshly-queued row): a running row, a
 * failed row with its expanded panel, and a completed row expanded to show
 * the proposal, findings and usage table.
 *
 * It seeds those rows directly in Supabase for a throwaway user (copying a
 * real completed analysis as the template if one exists, otherwise using a
 * built-in sample) and deletes the user — and, via cascade, every seeded
 * row — afterwards.
 *
 * Usage: node screenshot-results.mjs <webBaseUrl>
 */
import { chromium } from "playwright";
import path from "node:path";
import fs from "node:fs";
import { getAdminClient, createThrowawayUser, loginViaUI, REPO_ROOT } from "../../_shared/session.mjs";
import { seedResultRows } from "../../_shared/seed-results.mjs";

const webBaseUrl = process.argv[2];
if (!webBaseUrl) {
  console.error("Usage: node screenshot-results.mjs <webBaseUrl>");
  process.exit(2);
}

const OUT_DIR = path.join(REPO_ROOT, ".claude/skills/frontend-design/last-run");
fs.mkdirSync(OUT_DIR, { recursive: true });

const VIEWPORTS = [
  { name: "mobile", width: 375, height: 812 },
  { name: "desktop", width: 1280, height: 800 },
];

const admin = getAdminClient();

const user = await createThrowawayUser(admin);
const browser = await chromium.launch();

try {
  await seedResultRows(admin, user.id);

  for (const vp of VIEWPORTS) {
    console.log(`\n--- ${vp.name} (${vp.width}x${vp.height}) ---`);
    const context = await browser.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await context.newPage();
    await page.goto(`${webBaseUrl}/login`, { waitUntil: "networkidle" });
    await loginViaUI(page, webBaseUrl, user.email, user.password);
    await page.waitForSelector("text=Complete");

    // Full-page captures of a 5,000px+ expanded report are unreadable when
    // downscaled, and a fixed/sticky header renders mid-page in them. Instead
    // scroll through the page in viewport-sized steps, like a real user.
    const shot = async (label, { segments = 1 } = {}) => {
      const total = await page.evaluate(() => document.documentElement.scrollHeight);
      const step = vp.height;
      const count = Math.min(segments, Math.max(1, Math.ceil(total / step)));
      for (let i = 0; i < count; i++) {
        await page.evaluate((y) => window.scrollTo({ top: y, behavior: "instant" }), i * step);
        await page.waitForTimeout(150);
        const suffix = count > 1 ? `-part${i + 1}` : "";
        const file = path.join(OUT_DIR, `${label}-${vp.name}${suffix}.png`);
        await page.screenshot({ path: file });
        console.log("  wrote", file);
      }
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    };

    await shot("results-collapsed");

    const cards = page.locator("ul > li").filter({ has: page.getByRole("button", { name: /details/i }) });
    // Rows are newest-first: running (no toggle), complete, failed.
    await cards.nth(1).getByRole("button", { name: /details/i }).click();
    await shot("results-failed-expanded");

    await cards.nth(0).getByRole("button", { name: /details/i }).click();
    await page.waitForSelector("text=Total cost", { timeout: 10000 });
    await shot("results-complete-expanded", { segments: 4 });

    // Frame the expanded card's header + action buttons just under the sticky bar.
    await cards.nth(0).scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy({ top: -70, behavior: "instant" }));
    await page.waitForTimeout(150);
    const topFile = path.join(OUT_DIR, `results-card-top-${vp.name}.png`);
    await page.screenshot({ path: topFile });
    console.log("  wrote", topFile);

    // The usage table sits past the segment cap above; frame it directly.
    await page.getByText("Total cost").first().scrollIntoViewIfNeeded();
    await page.evaluate(() => window.scrollBy({ top: 200, behavior: "instant" }));
    await page.waitForTimeout(150);
    const usageFile = path.join(OUT_DIR, `results-usage-${vp.name}.png`);
    await page.screenshot({ path: usageFile });
    console.log("  wrote", usageFile);

    // Also show the collapsed informational findings opened up.
    const infoToggle = page.getByText(/Show \d+ informational/);
    if (await infoToggle.count()) {
      await infoToggle.first().click();
      // Keep the toggle in view so the shot shows the freshly opened list.
      await page.getByText(/Hide informational/).first().scrollIntoViewIfNeeded();
      const file = path.join(OUT_DIR, `results-complete-info-open-${vp.name}.png`);
      await page.screenshot({ path: file });
      console.log("  wrote", file);
    }

    await context.close();
  }
} finally {
  await browser.close();
  await admin.auth.admin.deleteUser(user.id);
}

console.log(`\nAll screenshots written to ${OUT_DIR}`);
