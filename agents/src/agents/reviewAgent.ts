import { createStubAgent } from "./stub";

// TODO: real implementation — critique architecture_agent's proposal for
// unsupported claims before it's returned to the user (README.md § 6).
export const reviewAgent = createStubAgent("review_agent");
