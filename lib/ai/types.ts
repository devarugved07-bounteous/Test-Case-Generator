/**
 * AI provider types for test case generation.
 * Business logic depends only on these types; providers implement the interface.
 */

export type ProviderName = "brain" | "claude" | "gemini";

export type GenerateOptions = {
  /** When "component", use component test prompt and treat input as code. When "steps", input is the full steps prompt; return raw response as steps.txt content. */
  mode?: "component" | "steps";
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
