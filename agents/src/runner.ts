/**
 * Runs the orchestrator standalone, without the api/ service.
 *
 * Usage:
 *   npm run dev -- <repo_url> "<question>"
 *   npm run dev -- https://github.com/octocat/Hello-World "How should I deploy this on AWS?"
 */
import { runOrchestrator } from "./orchestrator";

async function main() {
  const [repoUrl, question] = process.argv.slice(2);

  if (!repoUrl || !question) {
    console.error('Usage: npm run dev -- <repo_url> "<question>"');
    process.exit(1);
  }

  const result = await runOrchestrator({ repoUrl, question });
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
