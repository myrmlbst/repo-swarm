import { test } from "node:test";
import assert from "node:assert/strict";
import { redactSecrets } from "./redact";

test("redacts an AWS access key ID", () => {
  const out = redactSecrets("AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE");
  assert.ok(!out.includes("AKIAIOSFODNN7EXAMPLE"));
  assert.ok(out.includes("[REDACTED]"));
});

test("redacts an OpenAI/Anthropic-style secret key", () => {
  const out = redactSecrets("key = sk-abcdefghijklmnopqrstuvwxyz123456");
  assert.ok(!out.includes("sk-abcdefghijklmnopqrstuvwxyz123456"));
  assert.ok(out.includes("[REDACTED]"));
});

test("redacts a GitHub personal access token", () => {
  const token = "ghp_" + "a".repeat(36);
  const out = redactSecrets(`GITHUB_TOKEN=${token}`);
  assert.ok(!out.includes(token));
});

test("redacts a Slack token", () => {
  const out = redactSecrets("SLACK_TOKEN=xoxb-1234567890-abcdefghijklmnop");
  assert.ok(!out.includes("xoxb-1234567890-abcdefghijklmnop"));
});

test("redacts a PEM private key block", () => {
  const pem = [
    "-----BEGIN RSA PRIVATE KEY-----",
    "MIIEpAIBAAKCAQEA1234567890abcdef",
    "-----END RSA PRIVATE KEY-----",
  ].join("\n");
  const out = redactSecrets(pem);
  assert.ok(!out.includes("MIIEpAIBAAKCAQEA1234567890abcdef"));
  assert.ok(out.includes("[REDACTED]"));
});

test("redacts a generic KEY=value assignment with a long value", () => {
  const out = redactSecrets("OPENAI_API_KEY=abcdEFGH12345678ijklMNOP");
  assert.ok(
    out.startsWith("OPENAI_API_KEY="),
    "the key name itself should survive",
  );
  assert.ok(!out.includes("abcdEFGH12345678ijklMNOP"));
});

test("leaves ordinary text completely untouched", () => {
  const text = "This app uses Express and connects to a Postgres database.";
  assert.equal(redactSecrets(text), text);
});

test("does not redact a short value under the length threshold", () => {
  const text = "API_KEY=short";
  assert.equal(redactSecrets(text), text);
});
