/**
 * Detect likely React/Next.js UI components from file content.
 * Used for local uploads where we have file contents; GitHub flow uses extension-only.
 */

const REACT_COMPONENT_PATTERNS = [
  /\bexport\s+default\s+(?:function|class)\s+\w+/,
  /\bexport\s+default\s+\w+/,
  /export\s+default\s*\(/,
  /export\s+default\s*\{/,
  /function\s+\w+\s*\([^)]*\)\s*\{[\s\S]*?return\s*\(?\s*</,
  /const\s+\w+\s*=\s*(?:\([^)]*\)\s*=>|function)/,
  /class\s+\w+\s+extends\s+(?:React\.)?(?:Component|PureComponent)/,
  /<[A-Z][a-zA-Z]*[\s>]/,
];

const DEFAULT_EXPORT_PATTERNS = [
  /\bexport\s+default\s+/,
];

/**
 * Returns true if the content appears to be a React component (default export + component-like code).
 */
export function looksLikeComponent(content: string, extension: string): boolean {
  const ext = extension.toLowerCase();
  if (![".tsx", ".jsx", ".ts", ".js"].some((e) => ext.endsWith(e))) return false;
  const trimmed = content.trim();
  if (!trimmed.length) return false;
  const hasDefaultExport = DEFAULT_EXPORT_PATTERNS.some((re) => re.test(trimmed));
  const hasComponentLike = REACT_COMPONENT_PATTERNS.some((re) => re.test(trimmed));
  return hasDefaultExport && hasComponentLike;
}
