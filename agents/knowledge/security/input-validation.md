# Input Validation

User-supplied input (request bodies, query params, headers) should be validated before it's used in
a database query, shell command, or file path — otherwise it opens the door to injection-style
attacks.

What to look for:

- Request handlers that pass user input directly into a raw SQL string (string concatenation/
  interpolation) instead of a parameterized query or query builder.
- User input used to construct a file path or shell command without sanitization.
- No schema/type validation on request bodies at all — the handler just trusts whatever shape the
  JSON happens to be.

What's fine: parameterized queries or an ORM/query builder that parameterizes automatically, and a
validation library (e.g. Zod, Joi) checking request shape before the handler uses the data.
