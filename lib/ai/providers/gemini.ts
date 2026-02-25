import { GoogleGenerativeAI } from "@google/generative-ai";
import type { GenerateOptions, GenerateResult, ITestGeneratorProvider } from "../types";
import { buildPrompt } from "../prompts";
import { normalizeOutput } from "../normalize";
import { isCode } from "@/lib/isCode";

const GEMINI_MODEL = "models/gemini-flash-latest";

/**
 * Error codes we use for consistency (Gemini is fallback, so we don't retry elsewhere).
 */
export const GEMINI_ERROR_CODES = {
  AUTH: "gemini_auth",
  RATE_LIMIT: "gemini_rate_limit",
  TIMEOUT: "gemini_timeout",
  UNAVAILABLE: "gemini_unavailable",
  OTHER: "gemini_error",
} as const;

export function createGeminiProvider(apiKey: string): ITestGeneratorProvider {
  const genAI = new GoogleGenerativeAI(apiKey);
  const model = genAI.getGenerativeModel({ model: GEMINI_MODEL });

  return {
    name: "gemini",

    async generateTests(input: string, options?: GenerateOptions): Promise<GenerateResult> {
      const isSteps = options?.mode === "steps";
      const isCodeInput = !isSteps && (isCode(input) || options?.mode === "component");
      const { prompt, isCode: isCodeFlag, kind } = buildPrompt(input, isCodeInput, options?.mode);

      try {
        const result = await model.generateContent(prompt);
        const response = result.response;
        const rawText = response.text?.() ?? "";

        if (!rawText || !rawText.trim()) {
          return {
            success: false,
            error: "Gemini returned no text.",
            code: GEMINI_ERROR_CODES.OTHER,
          };
        }

        const norm = normalizeOutput(rawText, isCodeFlag);
        const tests = kind === "steps" ? rawText.trim() : norm.tests;
        const implementation = kind === "steps" ? undefined : norm.implementation ?? undefined;
        return {
          success: true,
          rawText,
          tests,
          implementation,
          isCode: isCodeFlag,
        };
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        const lower = message.toLowerCase();
        let code: (typeof GEMINI_ERROR_CODES)[keyof typeof GEMINI_ERROR_CODES] = GEMINI_ERROR_CODES.OTHER;
        if (/invalid|api key|403|401|authentication/.test(lower)) code = GEMINI_ERROR_CODES.AUTH;
        else if (/quota|rate|429|resource_exhausted/.test(lower)) code = GEMINI_ERROR_CODES.RATE_LIMIT;
        else if (/timeout|deadline|etimedout/.test(lower)) code = GEMINI_ERROR_CODES.TIMEOUT;
        else if (/503|502|504|unavailable/.test(lower)) code = GEMINI_ERROR_CODES.UNAVAILABLE;
        return {
          success: false,
          error: message,
          code,
        };
      }
    },
  };
}
