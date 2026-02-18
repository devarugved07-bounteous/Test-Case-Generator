/**
 * Shared prompts for test generation. Same prompts are used by all providers
 * so output format and behavior stay consistent.
 */

export const CODE_PROMPT = `You are an expert in Jest and React Testing Library. The user will provide JavaScript/TypeScript/React code.

Tasks:
1. Analyze the code and identify whether it is a React component, API route, custom hook, or plain function.
2. Generate a complete test file using Jest and React Testing Library only.
3. Cover: happy path, edge cases, props, user events, and if applicable API responses/mocks.
4. Do not include any explanation or markdown. Return ONLY the test file code, ready to copy. Use describe/it blocks and proper imports.`;

export const COMPONENT_TEST_PROMPT = `You are an expert in Jest and React Testing Library. The user will provide a React/JS/TS component file (e.g. .jsx, .tsx).

Generate a SINGLE, complete test file using Jest and React Testing Library only. The test file MUST include:

1. Unit tests: Validate props handling, state logic, and conditional logic.
2. Rendering tests: Ensure the component renders correctly, displays static and dynamic content, and handles conditional UI.
3. Interaction tests: Cover user actions—clicks, input changes, toggles, form submissions—using userEvent or fireEvent.
4. DOM and state update tests: Verify UI updates after state or prop changes.
5. Edge case tests: Empty data, null/undefined inputs, error states, long content rendering.
6. Accessibility tests (where applicable): Roles, labels (getByRole, getByLabelText), and keyboard accessibility.

Use describe/it blocks, proper imports (e.g. @testing-library/react, @testing-library/jest-dom, @testing-library/user-event), and mock any external dependencies. Do not include any explanation or markdown. Return ONLY the test file code, ready to copy.`;

export const REQUIREMENT_PROMPT = `You are an expert in JavaScript/TypeScript and Jest/React Testing Library. The user will provide a plain English requirement (e.g. "generate test cases for a function that adds two numbers").

Tasks:
1. First write the implementation (function or component) that satisfies the requirement.
2. Then write a complete Jest test file (with React Testing Library if it's a component) for that implementation.
3. Format your response exactly as follows, with no other text before or after:
---IMPLEMENTATION---
[full implementation code here]
---TESTS---
[full test file code here]
4. Use only describe/it blocks and proper imports. No explanations.`;

export type PromptKind = "code" | "component" | "requirement";

export type BuildPromptResult = {
  prompt: string;
  isCode: boolean;
  kind: PromptKind;
};

export function buildPrompt(
  input: string,
  isCodeInput: boolean,
  mode?: "component"
): BuildPromptResult {
  if (mode === "component") {
    return {
      prompt: `${COMPONENT_TEST_PROMPT}\n\nComponent source:\n\n${input}`,
      isCode: true,
      kind: "component",
    };
  }
  if (isCodeInput) {
    return {
      prompt: `${CODE_PROMPT}\n\nGenerate Jest + React Testing Library tests for this code:\n\n${input}`,
      isCode: true,
      kind: "code",
    };
  }
  return {
    prompt: `${REQUIREMENT_PROMPT}\n\nRequirement:\n\n${input}`,
    isCode: false,
    kind: "requirement",
  };
}
