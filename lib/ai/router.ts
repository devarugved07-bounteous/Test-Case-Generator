import type { GenerateOptions, GenerateResult, ProviderName } from "./types";
import { createClaudeProvider } from "./providers/claude";
import { createGeminiProvider } from "./providers/gemini";

/**
 * Response from the router including which provider was used (for logging and debugging).
 */
export type RouterResult = (GenerateResult & { success: true }) & {
  metadata: { provider: ProviderName };
};

export type RouterError = {
  success: false;
  error: string;
  metadata?: { attemptedProviders: ProviderName[] };
};

export type RouterResponse = RouterResult | RouterError;

/**
 * Whether the provider result indicates we should try the fallback.
 */
function shouldFallback(result: GenerateResult): boolean {
  if (result.success) return false;
  const code = (result as { code?: string }).code ?? "";
  return (
    /auth|rate_limit|timeout|unavailable|error/.test(code) || true
  );
}

/**
 * Try Claude first; on any failure (no key, auth, rate limit, timeout, unavailable),
 * fall back to Gemini. Log which provider was used and return provider in metadata.
 */
export async function generateTestsWithFallback(
  input: string,
  options?: GenerateOptions
): Promise<RouterResponse> {
  const claudeKey = process.env.CLAUDE_API_KEY?.trim();
  const geminiKey = process.env.GEMINI_API_KEY?.trim();

  const attempted: ProviderName[] = [];

  // 1) Prefer Claude if key is present
  if (claudeKey) {
    const claude = createClaudeProvider(claudeKey);
    attempted.push("claude");
    const result = await claude.generateTests(input, options);
    if (result.success) {
      console.log("[generate-tests] Provider used: claude");
      return { ...result, metadata: { provider: "claude" } };
    }
    if (shouldFallback(result)) {
      console.warn(
        "[generate-tests] Claude failed, falling back to Gemini:",
        (result as { error?: string }).error
      );
    }
  } else {
    console.log("[generate-tests] CLAUDE_API_KEY not set, using Gemini");
  }

  // 2) Fallback to Gemini
  if (geminiKey) {
    const gemini = createGeminiProvider(geminiKey);
    attempted.push("gemini");
    const result = await gemini.generateTests(input, options);
    if (result.success) {
      console.log("[generate-tests] Provider used: gemini (fallback)");
      return { ...result, metadata: { provider: "gemini" } };
    }
  }

  // Both failed or no Gemini key
  const noKeys = !claudeKey && !geminiKey;
  const errorMessage = noKeys
    ? "No AI provider configured. Set CLAUDE_API_KEY or GEMINI_API_KEY in .env.local."
    : attempted.length === 0
      ? "No AI provider configured. Set CLAUDE_API_KEY or GEMINI_API_KEY in .env.local."
      : "Test generation failed with all configured providers. Please try again later.";

  console.error("[generate-tests] All providers failed. Attempted:", attempted);
  return {
    success: false,
    error: errorMessage,
    metadata: { attemptedProviders: attempted },
  };
}
