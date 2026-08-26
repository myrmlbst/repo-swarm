import { createStubAgent } from "./stub";

// TODO: real implementation — retrieve from the `security` collection using
// code_agent's structured output, flag production security risks
// (README.md § 4). Also where secret-redaction guardrails apply
// (DESIGNDOC.md § 7).
export const securityAgent = createStubAgent("security_agent");
