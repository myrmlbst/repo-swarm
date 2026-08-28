# Transport Security

Traffic to a production app should be encrypted end-to-end, and the app shouldn't rely purely on
the platform in front of it to enforce that.

What to look for:

- No indication that HTTPS/TLS is enforced anywhere (no load balancer TLS termination configured,
  no HSTS header, no redirect from HTTP to HTTPS).
- Cookies or tokens that aren't marked `Secure`/`HttpOnly`, which would let them leak over an
  unencrypted connection or be read by client-side scripts.
- Disabled TLS certificate verification anywhere in outbound HTTP client code (e.g.
  `rejectUnauthorized: false`, `verify=False`) — this is a serious finding, not a nitpick, since it
  defeats TLS entirely for that connection.

What's fine: TLS termination at a load balancer with an HSTS header set, `Secure`/`HttpOnly` cookies,
and no disabled certificate verification.
