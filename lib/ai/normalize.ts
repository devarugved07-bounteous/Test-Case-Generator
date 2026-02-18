/**
 * Normalize model output so UI and downstream processing behave identically
 * regardless of provider (Claude vs Gemini).
 */

export type NormalizedOutput = {
  tests: string;
  implementation: string | null;
};

/**
 * Parse raw model text into tests (and optional implementation for requirement mode).
 */
export function normalizeOutput(rawText: string, isCodeInput: boolean): NormalizedOutput {
  let tests = rawText.trim();
  let implementation: string | null = null;

  if (
    !isCodeInput &&
    rawText.includes("---IMPLEMENTATION---") &&
    rawText.includes("---TESTS---")
  ) {
    const implMatch = rawText.match(/---IMPLEMENTATION---\s*([\s\S]*?)---TESTS---/);
    const testsMatch = rawText.match(/---TESTS---\s*([\s\S]*?)(?:\n*$)/);
    implementation = implMatch?.[1]?.trim() ?? null;
    tests = testsMatch?.[1]?.trim() ?? rawText.trim();
  }

  return { tests, implementation };
}
