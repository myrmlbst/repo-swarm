import type { AgentName, SpecialistAgent } from "../types";
import { codeAgent } from "./codeAgent";
import { cloudAgent } from "./cloudAgent";
import { securityAgent } from "./securityAgent";
import { architectureAgent } from "./architectureAgent";
import { reviewAgent } from "./reviewAgent";

export const agentRegistry: Record<AgentName, SpecialistAgent> = {
  code_agent: codeAgent,
  cloud_agent: cloudAgent,
  security_agent: securityAgent,
  architecture_agent: architectureAgent,
  review_agent: reviewAgent,
};
