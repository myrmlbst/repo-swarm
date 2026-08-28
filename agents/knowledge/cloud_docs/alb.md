# Application Load Balancer (ALB)

An ALB is the HTTP(S) entry point in front of ECS Fargate tasks (or EC2, or Lambda). It terminates
TLS, routes requests to target groups based on path/host rules, and health-checks backends.

When it fits: any HTTP API or web app running on ECS that needs a stable public entry point, TLS
termination, and the ability to scale backend tasks without changing the client-facing address.

Practical notes:

- TLS termination happens **at the ALB** (ACM-issued certificate) — the app behind it doesn't need
  to handle HTTPS itself, but should still enforce it isn't reachable except through the ALB.
- Health checks should point at a real health check endpoint (e.g. `/health`), not just the root
  path — a route that happens to return 200 isn't the same as confirming the app can serve traffic.
- One ALB can front multiple services via path-based or host-based routing rules; don't provision a
  new ALB per service unless there's a real isolation reason (e.g. separate security postures).
- ALB access logs (to S3) plus CloudWatch metrics (5xx rate, target response time) are the first
  place to look when diagnosing production issues.
