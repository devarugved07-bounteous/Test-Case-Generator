/**
 * Maps repository file paths to ZIP entry paths.
 * Mirrors original project structure with no extra wrapper folders (no "source", no duplicates).
 *
 * - GitHub: use repository name as root folder; path is repo-relative.
 * - Local: use path as-is (already includes uploaded root folder); only filename becomes .test.*
 */

export type ZipInputMode = "github" | "local";

export type GetTestZipEntryPathOptions = {
  inputMode: ZipInputMode;
  /**
   * Root folder name for the ZIP.
   * GitHub: repository name (e.g. "react-app").
   * Local: optional; if omitted, derived from first path segment.
   */
  rootFolderName?: string;
};

/**
 * Normalize path: forward slashes, no leading/trailing slashes.
 */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

/**
 * Get the test filename: original name with .test before extension.
 * e.g. "Button.tsx" → "Button.test.tsx", "useAuth.ts" → "useAuth.test.ts"
 */
export function getTestFileName(repoPath: string): string {
  const normalized = normalizePath(repoPath);
  const base = normalized.split("/").pop() ?? normalized;
  const match = base.match(/^(.+?)(\.[^.]+)$/);
  if (!match) return `${base}.test.tsx`;
  const [, name, ext] = match;
  return `${name}.test${ext}`;
}

/**
 * Build ZIP entry path. Preserves nested structure; no artificial wrapper folders.
 *
 * GitHub: repo paths are relative to repo root (e.g. src/components/Button.tsx).
 *   ZIP entry = rootFolderName/src/components/Button.test.tsx
 *
 * Local: paths include uploaded root (e.g. react-app/src/components/Button.tsx).
 *   ZIP entry = react-app/src/components/Button.test.tsx (path with test filename only).
 */
export function getTestZipEntryPath(
  repoPath: string,
  options: GetTestZipEntryPathOptions
): string {
  const normalized = normalizePath(repoPath);
  const segments = normalized.split("/").filter(Boolean);
  const testFileName = getTestFileName(repoPath);
  const relativePathWithTestFile =
    segments.length <= 1
      ? testFileName
      : [...segments.slice(0, -1), testFileName].join("/");

  if (options.inputMode === "github") {
    const root = (options.rootFolderName ?? "repo").replace(/^\/+|\/+$/g, "").split("/")[0] || "repo";
    return relativePathWithTestFile ? `${root}/${relativePathWithTestFile}` : `${root}/${testFileName}`;
  }

  // Local: path already has full structure; only replace filename. No wrapper, no duplicate nesting.
  return relativePathWithTestFile;
}
