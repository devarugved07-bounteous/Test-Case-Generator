const CODE_INDICATORS = [
  /\bfunction\s*\w*\s*\(/,
  /\breturn\s+/,
  /\bimport\s+.*\s+from\s+/,
  /\bexport\s+/,
  /=>\s*[{(]/,
  /<[A-Z][a-zA-Z]*[\s>]/,
  /<[a-z][a-zA-Z0-9]*[\s>]/,
  /<\/[a-zA-Z][a-zA-Z0-9]*\s*>/,
  /\bconst\s+\w+\s*=\s*(?:async\s*)?\(/,
  /\bclass\s+\w+/,
  /\binterface\s+\w+/,
  /\btype\s+\w+\s*=/,
  /`[^`]*\$\{[^}]+\}[^`]*`/,
  /\bawait\s+/,
  /\basync\s+function/,
  /\.(tsx?|jsx?)\s*['"]/,
  /useState|useEffect|useCallback|useMemo|useRef/,
];

// Returns true if the input looks like JS/TS/JSX code, false otherwise.

export function isCode(input: string): boolean {
  const trimmed = input.trim();
  if (!trimmed.length) return false;

  const lines = trimmed.split(/\r?\n/);
  const firstFewLines = lines.slice(0, 20).join("\n");

  for (const pattern of CODE_INDICATORS) {
    if (pattern.test(firstFewLines)) return true;
  }

  return false;
}
