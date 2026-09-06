import { supabaseAdmin } from "./supabaseAdmin";
import { env } from "../env";
import type { Identity } from "./identity";

function currentPeriodStart(): string {
  const now = new Date();
  return `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, "0")}-01`;
}

function secondsUntilNextPeriod(): number {
  const now = new Date();
  const nextMonth = new Date(
    Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1),
  );
  return Math.ceil((nextMonth.getTime() - now.getTime()) / 1000);
}

export interface QuotaResult {
  allowed: boolean;
  analysesUsed: number;
  /** Only meaningful when `allowed` is false — seconds until the quota resets. */
  retryAfterSeconds: number;
}

/**
 * Atomically checks the current month's analysis count against the quota
 * and increments it if under the limit — see check_and_increment_quota in
 * supabase/migrations/0003_usage_counters.sql for the atomicity guarantee.
 */
export async function checkAndIncrementQuota(
  identity: Identity,
): Promise<QuotaResult> {
  const { data, error } = await supabaseAdmin.rpc("check_and_increment_quota", {
    p_api_key_id: identity.kind === "api_key" ? identity.apiKeyId : null,
    p_user_id: identity.kind === "user" ? identity.userId : null,
    p_period_start: currentPeriodStart(),
    p_limit: env.ANALYSES_QUOTA_PER_MONTH,
  });

  if (error || !data || data.length === 0) {
    throw new Error(
      `Quota check failed: ${error?.message ?? "no data returned"}`,
    );
  }

  const row = data[0] as { allowed: boolean; analyses_used: number };
  return {
    allowed: row.allowed,
    analysesUsed: row.analyses_used,
    retryAfterSeconds: secondsUntilNextPeriod(),
  };
}
