/**
 * Maps repository file paths to ZIP entry paths preserving full directory hierarchy.
 * Only the filename gets .test before the extension; path is unchanged (with optional src/ prefix).
 */

const DEFAULT_ROOT = "src";

/**
 * Normalize path to forward slashes (no leading/trailing).
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
 * Build full relative path for ZIP entry: preserve directory hierarchy, only change filename to .test.<ext>.
 * If the path has no root folder (e.g. "components/Button.tsx" or "Button.tsx"), prepend "src/" so the
 * archive has a clear root. Path separators are forward slashes.
 *
 * Examples:
 *   src/components/Button.tsx     → src/components/Button.test.tsx
 *   src/hooks/useAuth.ts          → src/hooks/useAuth.test.ts
 *   src/pages/Home.tsx            → src/pages/Home.test.tsx
 *   components/Button.tsx         → src/components/Button.test.tsx (root prepended)
 */
export function getTestZipEntryPath(repoPath: string): string {
  const normalized = normalizePath(repoPath);
  const segments = normalized.split("/").filter(Boolean);
  const testFileName = getTestFileName(repoPath);

  if (segments.length <= 1) {
    return `${DEFAULT_ROOT}/${testFileName}`;
  }

  const dirParts = segments.slice(0, -1);
  const hasRoot = /^(src|app|lib)$/i.test(dirParts[0] ?? "");
  const dirPath = hasRoot ? dirParts.join("/") : `${DEFAULT_ROOT}/${dirParts.join("/")}`;
  return `${dirPath}/${testFileName}`;
}
