const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL!;

export interface Analysis {
  id: string;
  repo_url: string;
  status: "queued" | "running" | "complete" | "failed";
  proposal: string | null;
  review_approved: boolean | null;
  created_at: string;
  completed_at: string | null;
}

export interface Finding {
  id: string;
  agent_name: string;
  severity: "info" | "warn" | "critical";
  title: string;
  detail: string;
  disputed: boolean;
  created_at: string;
}

async function apiFetch(path: string, accessToken: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(
      typeof body.error === "string" ? body.error : JSON.stringify(body.error),
    );
  }

  return res.status === 204 ? null : res.json();
}

export function listAnalyses(
  accessToken: string,
): Promise<{ analyses: Analysis[] }> {
  return apiFetch("/v1/analyses", accessToken);
}

export function createAnalysis(
  accessToken: string,
  repoUrl: string,
): Promise<Analysis> {
  return apiFetch("/v1/analyses", accessToken, {
    method: "POST",
    body: JSON.stringify({ repo_url: repoUrl }),
  });
}

export function getFindings(
  accessToken: string,
  analysisId: string,
): Promise<{ findings: Finding[] }> {
  return apiFetch(`/v1/analyses/${analysisId}/findings`, accessToken);
}
