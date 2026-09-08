import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdtemp, rm, cp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const execFileAsync = promisify(execFile);

/**
 * Copies a golden-repo fixture's `files/` into a fresh temp directory and
 * turns it into a real, self-contained git repo (init + commit) — so
 * `code_agent`'s `git clone`/`git ls-remote` calls work against it exactly
 * like a real GitHub URL, just with a local path instead. Deliberately NOT
 * a git repo nested inside this project's own repo (that would make git
 * treat it as a submodule/gitlink) — it lives entirely in a temp dir,
 * scaffolded fresh on every eval run and cleaned up after.
 */
export async function withScaffoldedRepo<T>(
  fixtureFilesDir: string,
  fn: (repoPath: string) => Promise<T>,
): Promise<T> {
  const dir = await mkdtemp(join(tmpdir(), "repo-swarm-golden-"));
  try {
    await cp(fixtureFilesDir, dir, { recursive: true });
    await execFileAsync("git", ["init", "--initial-branch=main", "--quiet"], { cwd: dir });
    await execFileAsync("git", ["config", "user.email", "eval@repo-swarm.local"], { cwd: dir });
    await execFileAsync("git", ["config", "user.name", "repo-swarm eval"], { cwd: dir });
    await execFileAsync("git", ["add", "-A"], { cwd: dir });
    await execFileAsync("git", ["commit", "--quiet", "-m", "golden repo fixture"], { cwd: dir });
    return await fn(dir);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
