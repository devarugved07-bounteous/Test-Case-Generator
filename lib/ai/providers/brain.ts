import type { GenerateOptions, GenerateResult, ITestGeneratorProvider } from "../types";
import { buildPrompt, buildPromptParts, CONTINUATION_INSTRUCTION } from "../prompts";
import { normalizeOutput } from "../normalize";
import { isCode } from "@/lib/isCode";

/** Max component generations per conversation before starting a new one (used by client). */
export const MAX_COMPONENTS_PER_CONVERSATION = 10;

const BASE_URL =
  process.env.BRAIN_API_BASE_URL ||
  "https://brain-api.bounteous.tools/ai/v1";

const MODEL =
  process.env.BRAIN_MODEL ||
  "claude-sonnet-4-20250514";

const MAX_TOKENS = Number(process.env.BRAIN_MAX_TOKENS) || 4096;
const TIMEOUT = Number(process.env.BRAIN_TIMEOUT_MS) || 120000; // 120s to avoid aborting before gateway timeout

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
      const conversationId = opts?.conversationId ?? undefined;
      const continuing = Boolean(conversationId?.trim());
      const componentIndex = opts?.componentIndexInConversation;

      if (opts?.mode === "component" || isCodeInput) {
        const n = typeof componentIndex === "number" && componentIndex >= 1 ? componentIndex : "?";
        if (continuing) {
          console.log(
            `[Brain] Component ${n} in this conversation — system prompt not sent (reusing conversation)`
          );
        } else {
          console.log(
            `[Brain] Component ${n} in this conversation — system prompt sent (new conversation; next system prompt after 10 more components)`
          );
        }
      } else if (opts?.mode === "steps") {
        console.log(
          "[Brain] Steps.txt request —",
          continuing ? "same conversation (no system prompt)" : "system prompt sent"
        );
      }

      let messages: Array<{ role: "system" | "user"; content: string }>;
      let isCodeFlag: boolean;
      let kind: "code" | "component" | "requirement" | "steps";

      if (continuing) {
        const parts = buildPromptParts(input, isCodeInput, opts?.mode);
        isCodeFlag = parts.isCode;
        kind = parts.kind;
        const userContent =
          parts.kind === "component" || parts.kind === "code"
            ? CONTINUATION_INSTRUCTION + parts.userPrompt
            : parts.userPrompt;
        messages = [{ role: "user", content: userContent }];
        console.log("[Brain] --- Input sent to LLM (user only, no system prompt) ---");
        console.log(userContent);
        console.log("[Brain] --- End of input ---");
      } else {
        const { prompt, isCode: isCodeF, kind: k } = buildPrompt(input, isCodeInput, opts?.mode);
        isCodeFlag = isCodeF;
        kind = k;
        const parts = buildPromptParts(input, isCodeInput, opts?.mode);
        if (parts.systemPrompt) {
          // Single user message so the full prompt is visible in the Brain chat UI (system role is often hidden)
          const firstUserContent = `${parts.systemPrompt}\n\n---\n\n${parts.userPrompt}`;
          messages = [{ role: "user", content: firstUserContent }];
          console.log("[Brain] --- Input sent to LLM (with system prompt) ---");
          console.log("[Brain] System prompt:");
          console.log(parts.systemPrompt);
          console.log("[Brain] User message:");
          console.log(parts.userPrompt);
          console.log("[Brain] --- End of input ---");
        } else {
          messages = [{ role: "user", content: parts.userPrompt }];
          console.log("[Brain] --- Input sent to LLM (user only) ---");
          console.log(parts.userPrompt);
          console.log("[Brain] --- End of input ---");
        }
      }

      const body: Record<string, unknown> = {
        model: MODEL,
        max_tokens: MAX_TOKENS,
        temperature: 0.2,
        messages,
      };
      if (continuing) {
        body.conversation_id = conversationId;
      }

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
        const responseConversationId =
          typeof data.conversation_id === "string" ? data.conversation_id : undefined;

        const usage = data?.usage;
        if (usage && typeof usage === "object") {
          const promptTokens = usage.prompt_tokens ?? usage.input_tokens;
          const completionTokens = usage.completion_tokens ?? usage.output_tokens;
          const total = usage.total_tokens ?? (Number(promptTokens) + Number(completionTokens));
          console.log(
            "[Brain] tokens — input:",
            promptTokens ?? "—",
            "output:",
            completionTokens ?? "—",
            "total:",
            total ?? "—"
          );
        }

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
          ...(responseConversationId && { conversationId: responseConversationId }),
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