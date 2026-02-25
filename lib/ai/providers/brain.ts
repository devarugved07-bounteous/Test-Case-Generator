import type { GenerateOptions, GenerateResult, ITestGeneratorProvider } from "../types";
import { buildPrompt } from "../prompts";
import { normalizeOutput } from "../normalize";
import { isCode } from "@/lib/isCode";

const BASE_URL =
  process.env.BRAIN_API_BASE_URL ||
  "https://brain-api.bounteous.tools/ai/v1";

const MODEL =
  process.env.BRAIN_MODEL ||
  "claude-sonnet-4-20250514";

const MAX_TOKENS = Number(process.env.BRAIN_MAX_TOKENS) || 4096;
const TIMEOUT = Number(process.env.BRAIN_TIMEOUT_MS) || 120000; // 90s to avoid aborting before gateway timeout

export const BRAIN_ERROR_CODES = {
  AUTH: "brain_auth",
  PERMISSION: "brain_permission",
  RATE_LIMIT: "brain_rate_limit",
  QUOTA: "brain_quota",
  TIMEOUT: "brain_timeout",
  NETWORK: "brain_network",
  PROVIDER: "brain_provider_error",
  INVALID_REQUEST: "brain_invalid_request",
  UNAVAILABLE: "brain_unavailable",
  EMPTY: "brain_empty_response",
  UNKNOWN: "brain_unknown",
} as const;

function classifyError(status: number, text: string, err?: any) {
  const msg = text.toLowerCase();

  if (status === 401 || /invalid.*api|unauthorized|authentication/.test(msg))
    return BRAIN_ERROR_CODES.AUTH;

  if (status === 403 || /permission|forbidden|workspace/.test(msg))
    return BRAIN_ERROR_CODES.PERMISSION;

  if (status === 429 || /rate|limit|too many/.test(msg))
    return BRAIN_ERROR_CODES.RATE_LIMIT;

  if (/quota|billing|exceeded/.test(msg))
    return BRAIN_ERROR_CODES.QUOTA;

  if (status === 400 || /invalid|validation|required|max_tokens/.test(msg))
    return BRAIN_ERROR_CODES.INVALID_REQUEST;

  if (status >= 500 || /overloaded|unavailable|capacity/.test(msg))
    return BRAIN_ERROR_CODES.UNAVAILABLE;

  if (err?.name === "AbortError")
    return BRAIN_ERROR_CODES.TIMEOUT;

  if (err?.code === "ENOTFOUND" || err?.code === "ECONNRESET")
    return BRAIN_ERROR_CODES.NETWORK;

  if (/anthropic|provider/.test(msg))
    return BRAIN_ERROR_CODES.PROVIDER;

  return BRAIN_ERROR_CODES.UNKNOWN;
}

export function createBrainProvider(apiKey: string): ITestGeneratorProvider {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
    Accept: "application/json",
    "User-Agent": "SampleTestcaseGenerator/1.0 (Bounteous Brain)",
  };

  async function fetchWithTimeout(body: unknown) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), TIMEOUT);

    try {
      const res = await fetch(`${BASE_URL}/chat/completions`, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      const text = await res.text();
      return { res, text };
    } finally {
      clearTimeout(id);
    }
  }

  function extractText(data: any): string {
    const choice = data?.choices?.[0];
    if (!choice) return "";

    if (typeof choice?.message?.content === "string")
      return choice.message.content;

    if (Array.isArray(choice?.message?.content))
      return choice.message.content.map((c: any) => c.text ?? "").join("");

    if (choice?.text) return choice.text;

    return "";
  }

  function isHtmlOrXml(text: string) {
    return text.trimStart().startsWith("<");
  }

  return {
    name: "brain",

    async generateTests(input: string, opts?: GenerateOptions): Promise<GenerateResult> {
      const isSteps = opts?.mode === "steps";
      const isCodeInput = !isSteps && (isCode(input) || opts?.mode === "component");
      const { prompt, isCode: isCodeFlag, kind } = buildPrompt(
        input,
        isCodeInput,
        opts?.mode
      );

      const body = {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        temperature: 0.2,
        messages: [{ role: "user", content: prompt }],
      };

      try {
        let { res, text } = await fetchWithTimeout(body);

        // retry once on gateway/transient errors (502, 503, or HTML/XML from proxy)
        const shouldRetry =
          !res.ok &&
          (res.status === 502 || res.status === 503 || isHtmlOrXml(text));
        if (shouldRetry) {
          await new Promise((r) => setTimeout(r, 1500)); // brief delay before retry
          ({ res, text } = await fetchWithTimeout(body));
        }

        if (!res.ok) {
          return {
            success: false,
            error: text || res.statusText,
            code: classifyError(res.status, text),
          };
        }

        const data = JSON.parse(text);
        const rawText = extractText(data);

        if (!rawText.trim()) {
          return {
            success: false,
            error: "Empty response from Brain",
            code: BRAIN_ERROR_CODES.EMPTY,
          };
        }

        const norm = kind === "steps" ? null : normalizeOutput(rawText, isCodeFlag);
        const tests = kind === "steps" ? rawText.trim() : norm!.tests;
        const implementation = kind === "steps" ? undefined : norm!.implementation ?? undefined;

        return {
          success: true,
          rawText,
          tests,
          implementation,
          isCode: isCodeFlag,
        };
      } catch (err: any) {
        return {
          success: false,
          error: err.message ?? "Unknown Brain error",
          code: classifyError(0, err.message ?? "", err),
        };
      }
    },
  };
}