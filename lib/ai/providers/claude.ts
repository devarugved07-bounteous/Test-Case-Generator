import Anthropic from "@anthropic-ai/sdk";
import type { GenerateOptions, GenerateResult, ITestGeneratorProvider } from "../types";
import { buildPrompt } from "../prompts";
import { normalizeOutput } from "../normalize";
import { isCode } from "@/lib/isCode";

const CLAUDE_MODEL = "claude-sonnet-4-20250514";
const MAX_TOKENS = 8192;

/**
 * Error codes we use to decide when to fall back to another provider.
 */
export const CLAUDE_ERROR_CODES = {
  AUTH: "claude_auth",
  RATE_LIMIT: "claude_rate_limit",
  TIMEOUT: "claude_timeout",
  UNAVAILABLE: "claude_unavailable",
  OTHER: "claude_error",
} as const;

function classifyClaudeError(err: unknown): string {
  const message = err instanceof Error ? err.message : String(err);
  const lower = message.toLowerCase();
  if (
    /invalid.*api.*key|authentication|401|unauthorized|invalid_api_key/.test(lower)
  ) {
    return CLAUDE_ERROR_CODES.AUTH;
  }
  if (/rate|limit|429|overloaded|capacity|quota/.test(lower)) {
    return CLAUDE_ERROR_CODES.RATE_LIMIT;
  }
  if (/timeout|timed out|etimedout|deadline/.test(lower)) {
    return CLAUDE_ERROR_CODES.TIMEOUT;
  }
  if (/503|502|504|service.*unavailable|unavailable/.test(lower)) {
    return CLAUDE_ERROR_CODES.UNAVAILABLE;
  }
  return CLAUDE_ERROR_CODES.OTHER;
}

export function createClaudeProvider(apiKey: string): ITestGeneratorProvider {
  const client = new Anthropic({ apiKey });

  return {
    name: "claude",

    async generateTests(input: string, options?: GenerateOptions): Promise<GenerateResult> {
      const isCodeInput = isCode(input) || options?.mode === "component";
      const { prompt, isCode: isCodeFlag } = buildPrompt(input, isCodeInput, options?.mode);

      try {
        const message = await client.messages.create({
          model: CLAUDE_MODEL,
          max_tokens: MAX_TOKENS,
          messages: [{ role: "user", content: prompt }],
        });

        const textBlock = message.content.find((block) => block.type === "text");
        const rawText =
          textBlock && "text" in textBlock ? (textBlock as { text: string }).text : "";

        if (!rawText || !rawText.trim()) {
          return {
            success: false,
            error: "Claude returned no text.",
            code: CLAUDE_ERROR_CODES.OTHER,
          };
        }

        const { tests, implementation } = normalizeOutput(rawText, isCodeFlag);
        return {
          success: true,
          rawText,
          tests,
          implementation: implementation ?? undefined,
          isCode: isCodeFlag,
        };
      } catch (err) {
        const code = classifyClaudeError(err);
        const message = err instanceof Error ? err.message : String(err);
        return {
          success: false,
          error: message,
          code,
        };
      }
    },
  };
}
