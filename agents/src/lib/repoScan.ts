import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, extname, basename } from "node:path";

const EXCLUDED_DIRS = new Set([
  ".git",
  "node_modules",
  "dist",
  "build",
  "out",
  ".next",
  "vendor",
  "target",
  "venv",
  ".venv",
  "__pycache__",
  "coverage",
]);

// Not worth embedding: binaries, images, fonts, archives, lockfiles, and
// minified/generated output — low signal-to-token-cost for RAG.
const EXCLUDED_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".ico",
  ".webp",
  ".bmp",
  ".woff",
  ".woff2",
  ".ttf",
  ".eot",
  ".otf",
  ".zip",
  ".tar",
  ".gz",
  ".7z",
  ".rar",
  ".exe",
  ".dll",
  ".so",
  ".dylib",
  ".bin",
  ".wasm",
  ".pdf",
  ".mp4",
  ".mp3",
  ".mov",
]);
const EXCLUDED_FILENAMES = new Set([
  "package-lock.json",
  "yarn.lock",
  "pnpm-lock.yaml",
  "cargo.lock",
  "poetry.lock",
  "gemfile.lock",
  "composer.lock",
]);

const MAX_TREE_ENTRIES = 500;
const MAX_INDEXABLE_FILES = 200;
const MAX_FILE_BYTES = 50_000;
const MAX_TOTAL_CHARS = 400_000;

export interface RepoFile {
  path: string;
  content: string;
}

async function walk(dir: string, root: string, tree: string[]): Promise<void> {
  if (tree.length >= MAX_TREE_ENTRIES) return;

  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (tree.length >= MAX_TREE_ENTRIES) return;
    if (entry.name.startsWith(".") && entry.name !== ".env.example") continue;

    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (EXCLUDED_DIRS.has(entry.name)) continue;
      await walk(fullPath, root, tree);
    } else if (entry.isFile()) {
      tree.push(relative(root, fullPath));
    }
  }
}

/** Directory-structure overview: relative file paths, capped. */
export async function buildTree(dir: string): Promise<string[]> {
  const tree: string[] = [];
  await walk(dir, dir, tree);
  return tree;
}

function isIndexable(path: string): boolean {
  const name = basename(path).toLowerCase();
  if (EXCLUDED_FILENAMES.has(name)) return false;
  if (name.endsWith(".min.js") || name.endsWith(".min.css")) return false;
  return !EXCLUDED_EXTENSIONS.has(extname(name));
}

/**
 * Reads content for as much of the repo as fits a cost/time budget (file
 * count, per-file size, total characters). This is what gets chunked and
 * embedded for the `repository` collection — see codeAgent.ts.
 */
export async function collectIndexableFiles(
  dir: string,
  tree: string[],
): Promise<RepoFile[]> {
  const candidates = tree.filter(isIndexable).slice(0, MAX_INDEXABLE_FILES);

  const files: RepoFile[] = [];
  let totalChars = 0;

  for (const path of candidates) {
    if (totalChars >= MAX_TOTAL_CHARS) break;

    const fullPath = join(dir, path);
    const info = await stat(fullPath);
    if (info.size > MAX_FILE_BYTES) continue;

    const content = await readFile(fullPath, "utf-8").catch(() => null);
    if (content === null) continue; // skip anything that isn't valid UTF-8 (likely binary)

    const remaining = MAX_TOTAL_CHARS - totalChars;
    const truncated =
      content.length > remaining ? content.slice(0, remaining) : content;
    files.push({ path, content: truncated });
    totalChars += truncated.length;
  }

  return files;
}
