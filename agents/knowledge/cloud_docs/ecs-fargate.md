# ECS Fargate

Amazon ECS Fargate runs containers without managing the underlying EC2 instances — you define a
task (CPU/memory, container image, port mappings) and Fargate schedules it onto managed capacity.

When it fits: the application is (or can be) containerized (has or can have a Dockerfile), is
stateless at the compute layer (any state lives in RDS/ElastiCache/S3, not on local disk), and
doesn't need GPU or specialized instance types.

Practical notes:

- Tasks should run in **private subnets**; only the load balancer sits in a public subnet.
- Use a **task execution role** (pulls the image, writes logs) separate from a **task role** (what
  the running application itself is allowed to call) — the execution role should never be handed to
  application code.
- Set real CPU/memory requests based on the app's actual footprint, not defaults — oversized tasks
  waste money, undersized tasks get OOM-killed under load.
- Configure a container health check (or rely on the ALB target group health check) so ECS can
  replace unhealthy tasks automatically.
