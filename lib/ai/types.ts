/**
 * AI provider types for test case generation.
 * Business logic depends only on these types; providers implement the interface.
 */

export type ProviderName = "brain" | "claude" | "gemini";

export type GenerateOptions = {
  /** When "component", use component test prompt and treat input as code. When "steps", input is the full steps prompt; return raw response as steps.txt content. */
  mode?: "component" | "steps";
  /** Brain API: continue this conversation (avoid resending system prompt). Omit or null to start a new conversation. */
  conversationId?: string | null;
  /** 1-based index of this component in the current conversation (for logging). */
  componentIndexInConversation?: number;
};

export type GenerateSuccess = {
  success: true;
  /** Raw text from the model before normalization */
  rawText: string;
  /** Final test file content (after parsing ---IMPLEMENTATION---/---TESTS--- if applicable) */
  tests: string;
  /** Implementation code if requirement mode produced it */
  implementation?: string;
  /** Whether input was treated as code (vs plain requirement) */
  isCode: boolean;
  /** Brain API: conversation ID from response; send on next request to continue the same conversation. */
  conversationId?: string;
};

export type GenerateFailure = {
  success: false;
  error: string;
  /** Provider-specific error code or message for fallback logic */
  code?: string;
};

export type GenerateResult = GenerateSuccess | GenerateFailure;

/**
 * Provider interface. All AI calls go through this so we can switch models
 * without changing business logic.
 */
export interface ITestGeneratorProvider {
  readonly name: ProviderName;
  /**
   * Generate test file content (and optionally implementation) for the given input.
   * Returns normalized { tests, implementation?, isCode } on success.
   */
  generateTests(input: string, options?: GenerateOptions): Promise<GenerateResult>;
}
