/**
 * Regex-based secret redaction, applied to repo content before it reaches
 * an LLM prompt or a findings record — DESIGNDOC.md § 7.2. Deliberately
 * simple (pattern match, not entropy analysis): catches common credential
 * shapes without needing a corpus of real secrets to tune against.
 */
const SECRET_PATTERNS: RegExp[] = [
  /AKIA[0-9A-Z]{16}/g, // AWS access key ID
  /sk-[A-Za-z0-9]{20,}/g, // OpenAI/Anthropic-style secret key
  /gh[pousr]_[A-Za-z0-9]{36}/g, // GitHub personal/OAuth/user/server token
  /xox[baprs]-[A-Za-z0-9-]{10,}/g, // Slack token
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/g,
];

// KEY=value / TOKEN: "value" style assignments, e.g. OPENAI_API_KEY=sk-...
const ASSIGNMENT_PATTERN =
  /((?:API|SECRET|ACCESS|PRIVATE|CLIENT)[_-]?(?:KEY|TOKEN|SECRET)\s*[:=]\s*["']?)([A-Za-z0-9\-_/+=]{12,})/gi;

export function redactSecrets(content: string): string {
  let redacted = content;
  for (const pattern of SECRET_PATTERNS) {
    redacted = redacted.replace(pattern, "[REDACTED]");
  }
  return redacted.replace(ASSIGNMENT_PATTERN, "$1[REDACTED]");
}
