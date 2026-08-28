# Secrets Handling

No API key, database password, or signing key should be hardcoded in source code or committed in a
`.env` file. This is one of the most common findings in real repos and one of the easiest to check
for mechanically.

What to look for:

- A literal-looking key/token value assigned to a variable named like `*_KEY`, `*_TOKEN`,
  `*_SECRET`, or `*_PASSWORD` in a committed file (not `.env.example`, which should only have
  placeholder values).
- A `.env` file itself committed to the repo (as opposed to `.env.example`).
- Credentials passed as plain command-line arguments or embedded in a connection string in source,
  rather than read from environment variables or a secrets manager at runtime.

What's fine: reading a secret from `process.env` (or equivalent) at runtime, an `.env.example` file
with placeholder values, or a secrets-manager SDK call.
