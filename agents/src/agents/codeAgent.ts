import { createStubAgent } from "./stub";

// TODO: real implementation — index the repo (chunk -> embed -> vector DB),
// retrieve relevant chunks for `context.task`, and return structured facts
// (framework, database, auth method, issues) as described in README.md § 2.
export const codeAgent = createStubAgent("code_agent");
