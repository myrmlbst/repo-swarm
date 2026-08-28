# Dependency Risk

Not every outdated dependency is a real finding — "keep dependencies updated" as a generic note adds
noise, not signal. Flag a dependency only when there's a specific, visible risky pattern tied to it.

What to look for:

- A dependency known for a specific class of risk being used in a way that triggers it (e.g. an XML
  parser configured to resolve external entities, enabling XXE).
- A package pulled from an unpinned/floating version range for something security-sensitive (auth,
  crypto), where an unreviewed transitive update could silently change behavior.
- Disabled security features in a dependency's own configuration (e.g. a validation library
  explicitly configured to skip checks).

What's not a finding on its own: a dependency simply being a few versions behind, with no specific
visible risk tied to that gap. That's routine maintenance, not a security issue to call out.
