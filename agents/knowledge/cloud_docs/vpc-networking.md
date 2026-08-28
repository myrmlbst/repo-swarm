# VPC: Public/Private Subnets

A VPC with public and private subnets is the standard network isolation pattern: public subnets
hold only internet-facing resources (the ALB, a NAT Gateway), private subnets hold everything else
(ECS tasks, RDS, ElastiCache).

Practical notes:

- Spread subnets across at least 2 Availability Zones for basic resilience to an AZ outage.
- Only the ALB's security group should allow inbound traffic from `0.0.0.0/0`; the ECS service's
  security group should only allow inbound from the ALB's security group, and RDS/ElastiCache's
  security groups should only allow inbound from the ECS service's security group.
- A NAT Gateway lets resources in private subnets reach the internet outbound (e.g. to pull npm
  packages at build time, or call an external API) without being reachable inbound. Only add one if
  something in private subnets actually needs outbound internet access — it has an hourly + data
  transfer cost, so it's not free to include reflexively.
- Database subnets don't need a route to the internet at all if the app never needs to reach out
  from the DB tier.
