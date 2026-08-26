/**
 * Shared helper for the accessibility-review and frontend-design skills:
 * creates a throwaway confirmed Supabase user and logs it into the running
 * web app so authenticated routes can be audited/screenshotted.
 */
import { config } from "dotenv";
import { createClient } from "@supabase/supabase-js";
import { chromium } from "playwright";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const REPO_ROOT = path.resolve(__dirname, "../../..");

config({ path: path.join(REPO_ROOT, "api/.env") });

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY not found in api/.env — the API's real " +
      "Supabase project must be configured before these skills can log in for an audit.",
  );
}

export function getAdminClient() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

/** Creates a confirmed throwaway user. Caller is responsible for deleting it. */
export async function createThrowawayUser(admin) {
  const email = `skill-audit-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.com`;
  const password = "SkillAudit!23456";
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  return { id: data.user.id, email, password };
}

/** Drives the actual login form. Assumes `page` is already at `${webBaseUrl}/login`. */
export async function loginViaUI(page, webBaseUrl, email, password) {
  await page.fill("#email", email);
  await page.fill("#password", password);
  await page.click("button[type=submit]");
  await page.waitForURL(`${webBaseUrl}/`, { timeout: 10000 });
  await page.waitForLoadState("networkidle");
}

/**
 * Convenience wrapper: creates a user, launches Chromium, logs in, hands you
 * a logged-in page at "/", and cleans everything up afterwards.
 * @param {(page: import("playwright").Page, ctx: { browser: import("playwright").Browser }) => Promise<void>} fn
 */
export async function withLoggedInPage({ webBaseUrl }, fn) {
  const admin = getAdminClient();
  const user = await createThrowawayUser(admin);
  let browser;

  try {
    browser = await chromium.launch();
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto(`${webBaseUrl}/login`, { waitUntil: "networkidle" });
    await loginViaUI(page, webBaseUrl, user.email, user.password);
    await fn(page, { browser });
  } finally {
    if (browser) await browser.close();
    await admin.auth.admin.deleteUser(user.id);
  }
}
