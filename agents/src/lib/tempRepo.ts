import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

/**
 * Gets a repo's current default-branch commit SHA without cloning anything —
 * just a network round trip. Used to check the code-facts cache (see
 * codeAgent.ts) before paying for a clone at all.
 */
export async function getRemoteCommitSha(repoUrl: string): Promise<string> {
  const { stdout } = await execFileAsync("git", ["ls-remote", repoUrl, "HEAD"]);
  const sha = stdout.split(/\s+/)[0];
  if (!sha) {
    throw new Error(`Could not resolve HEAD for ${repoUrl}`);
  }
  return sha;
}

/**
 * Shallow-clones a public repo into a temp directory and hands it — plus the
 * clone's commit SHA — to `fn`, cleaning up afterwards regardless of success
 * or failure.
 */
export async function withClonedRepo<T>(
  repoUrl: string,
  fn: (dir: string, commitSha: string) => Promise<T>,
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "repo-swarm-"));
  try {
    await execFileAsync("git", [
      "clone",
      "--depth",
      "1",
      "--quiet",
      repoUrl,
      dir,
    ]);
    const { stdout } = await execFileAsync("git", ["rev-parse", "HEAD"], {
      cwd: dir,
    });
    return await fn(dir, stdout.trim());
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
