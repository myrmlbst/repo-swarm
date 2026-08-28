# Auto Scaling & CloudWatch

ECS Service Auto Scaling adjusts the number of running tasks based on a metric (CPU/memory
utilization, or ALB request count per target). CloudWatch is where ECS task logs, ALB metrics, and
alarms live.

Practical notes:

- Start with a small, sane min/max range (e.g. 1–2 minimum for basic availability, a modest max)
  rather than guessing a large range — there's no traffic data to size against before the app has
  real usage, so don't over-provision speculatively.
- Scale on the metric that actually reflects load for the app: CPU/memory for compute-bound work,
  request count per target for I/O-bound APIs waiting on a database or external call.
- Ship container logs to CloudWatch via the `awslogs` driver in the task definition — without this,
  a crashed task's logs are gone the moment it's replaced.
- Set at least one alarm that would actually page someone (e.g. 5xx rate on the ALB, or ECS service
  running below its desired task count) — logs that nobody looks at until something breaks aren't
  real observability.
