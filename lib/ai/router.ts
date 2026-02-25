import type { GenerateOptions, GenerateResult, ProviderName } from "./types";
import { createBrainProvider } from "./providers/brain";
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
 * Try Bounteous Brain first (if BRAIN_API_KEY set), then Claude, then Gemini.
 * On any failure (no key, auth, rate limit, timeout, unavailable), fall back to the next.
 * Log which provider was used and return provider in metadata.
 */
export async function generateTestsWithFallback(
  input: string,
  options?: GenerateOptions
): Promise<RouterResponse> {
  const brainKey = process.env.BRAIN_API_KEY?.trim();
  const claudeKey = process.env.CLAUDE_API_KEY?.trim();
  const geminiKey = process.env.GEMINI_API_KEY?.trim();

  const attempted: ProviderName[] = [];

  // 1) Prefer Bounteous Brain (org workspace) if key is present
  if (brainKey) {
    const brain = createBrainProvider(brainKey);
    attempted.push("brain");
    const result = await brain.generateTests(input, options);
    if (result.success) {
      console.log("[generate-tests] Provider used: brain (Bounteous Brain)");
      return { ...result, metadata: { provider: "brain" } };
    }
    if (shouldFallback(result)) {
      console.warn(
        "[generate-tests] Bounteous Brain failed, trying next provider:",
        (result as { error?: string }).error
      );
    }
  }

  // 2) Then Claude
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
  } else if (!brainKey) {
    console.log("[generate-tests] CLAUDE_API_KEY not set, using Gemini");
  }

  // 3) Fallback to Gemini
  if (geminiKey) {
    const gemini = createGeminiProvider(geminiKey);
    attempted.push("gemini");
    const result = await gemini.generateTests(input, options);
    if (result.success) {
      console.log("[generate-tests] Provider used: gemini (fallback)");
      return { ...result, metadata: { provider: "gemini" } };
    }
  }

  const noKeys = !brainKey && !claudeKey && !geminiKey;
  const onlyBrainAttempted = attempted.length === 1 && attempted[0] === "brain";
  const onlyClaudeAttempted = attempted.length === 1 && attempted[0] === "claude";
  let errorMessage: string;
  if (noKeys || attempted.length === 0) {
    errorMessage =
      "No AI provider configured. Set BRAIN_API_KEY, CLAUDE_API_KEY, or GEMINI_API_KEY in .env.local. Get Brain key: https://brain.bounteous.tools/docs/v1/chat-completions";
  } else if (onlyBrainAttempted && !claudeKey && !geminiKey) {
    errorMessage =
      "Bounteous Brain failed. Check BRAIN_API_KEY in .env.local or add CLAUDE_API_KEY/GEMINI_API_KEY for fallback. Docs: https://brain.bounteous.tools/docs/v1/chat-completions";
  } else if (onlyClaudeAttempted && !geminiKey) {
    errorMessage =
      "Claude failed (check CLAUDE_API_KEY in .env.local). Add GEMINI_API_KEY for fallback, or fix your Claude key at https://console.anthropic.com/.";
  } else {
    errorMessage =
      "Test generation failed with all configured providers. Please try again later.";
  }

  console.error("[generate-tests] All providers failed. Attempted:", attempted);
  return {
    success: false,
    error: errorMessage,
    metadata: { attemptedProviders: attempted },
  };
}
