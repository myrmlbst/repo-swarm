import type { Analysis, Finding } from "./api";

const SEVERITY_LABEL: Record<Finding["severity"], string> = {
  info: "Info",
  warn: "Warning",
  critical: "Critical",
};

/**
 * Assembles one Markdown document from an analysis + its findings — the
 * single source of text used by both the "Copy" button (raw text to the
 * clipboard) and the "Download as PDF" view (rendered via MarkdownProposal,
 * see AnalysesList.tsx), so the two never drift apart.
 */
export function buildReportMarkdown(
  analysis: Analysis,
  findings: Finding[],
): string {
  const lines: string[] = [];

  lines.push("# Repo Swarm Analysis Report");
  lines.push("");
  // A list, not consecutive bold lines — Markdown collapses lines with no
  // blank line between them into a single paragraph, which ran every field
  // together on one line ("Repository: ... Status: complete Review ...").
  lines.push(`- **Repository:** ${analysis.repo_url}`);
  lines.push(`- **Status:** ${analysis.status}`);
  if (analysis.review_approved !== null) {
    lines.push(
      `- **Review verdict:** ${analysis.review_approved ? "Approved" : "Flagged concerns"}`,
    );
  }
  if (analysis.completed_at) {
    lines.push(
      `- **Completed:** ${new Date(analysis.completed_at).toLocaleString()}`,
    );
  }
  lines.push("");

  if (analysis.proposal) {
    lines.push("## Proposal");
    lines.push("");
    lines.push(analysis.proposal.trim());
    lines.push("");
  }

  lines.push("## Findings");
  lines.push("");
  if (findings.length === 0) {
    lines.push("No findings reported.");
  } else {
    for (const finding of findings) {
      const disputed = finding.disputed ? " _(disputed by review)_" : "";
      lines.push(
        `- **[${SEVERITY_LABEL[finding.severity]}] ${finding.title}** — ${finding.agent_name}${disputed}`,
      );
      if (finding.detail && finding.detail !== finding.title) {
        lines.push(`  ${finding.detail}`);
      }
      if (finding.source_refs.length > 0) {
        lines.push(`  Sources: ${finding.source_refs.join(", ")}`);
      }
    }
  }
  lines.push("");

  return lines.join("\n");
}
