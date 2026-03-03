/**
 * Shared prompts for simple, beginner-friendly Jest + React Testing Library test generation.
 * Supports React (plain), Vite, CRA, Next.js, and TypeScript.
 */

const FILE_PLACEMENT_RULES = `
FILE PLACEMENT:
- Place the test file beside its corresponding component.
- Maintain project structure.
- Header Path and Run command MUST match actual file location.
- Support .js, .jsx, .ts, .tsx.
- Resolve correct component filename (page.tsx vs index.tsx vs Component.tsx)
- Never guess filename
`;

const HEADER_COMMENT_RULE = `
HEADER COMMENT (REQUIRED):

/**
 * Test: <ComponentOrFunctionName>
 * Path: <relative/path/to/TestFile.test.tsx>
 * Run: npm test -- <relative/path/to/TestFile.test.tsx>
 */

- Use npm test (NEVER npx jest).
- No explanations.
`;

const STACK_AND_IMPORTS = `
STACK & IMPORTS:
- Supports React, Vite, CRA, Next.js, TypeScript.
- Detect stack only for compatibility.
- Do NOT add router/providers.
- Do NOT duplicate imports.
- Do NOT import React unless required.
- For Next.js App Router:
    - Use "./page" for page.tsx
    - DO NOT use "./index" inside app/
    - Detect correct filename before importing
`;

const SIMPLE_MOCKING = `
MOCKING:
- Mock only when jsdom would break.
- Do NOT auto-wrap providers.
- Example:
  jest.mock('path', () => ({ hook: jest.fn() }));
`;

const TEST_FOCUS = `
TEST FOCUS:
- Smoke render
- User interactions
- Conditional rendering
- Props behavior
- Visible text
- Accessibility basics
`;

const BUTTON_NAME_RESILIENCE = `
BUTTON & LABEL RESILIENCE:
- Button text may be split across nodes.
- Prefer:
    getByRole('button', { name: /count is/i })
- Avoid exact text like /count is 0/i
- Verify updates using toHaveTextContent()
`;

const QUERIES_AND_INTERACTIONS = `
QUERIES & INTERACTIONS:
- Prefer getByRole
- getByText for visible text
- getByLabelText for forms
- Use userEvent (avoid fireEvent)
- Avoid brittle selectors
`;

const USER_EVENT_AND_ASYNC_RULES = `
USER EVENT SAFETY:
- For user-event v14+ ALWAYS:

    const user = userEvent.setup();
    await user.click(button);

- Interaction tests MUST be async.
- NEVER call userEvent.click() directly.
`;

const TEXT_MATCHING_STABILITY = `
TEXT MATCHING:
- JSX may split text across elements.
- Prefer flexible matchers:

    getByText(/edit.*save/i)

- Avoid exact full-string matches.
`;

const ACCESSIBLE_NAME_STABILITY = `
ACCESSIBLE NAME STABILITY:
- Inline tags (<code>, <span>) split text.
- Use partial or regex matching.
`;

const ASSERTION_STABILITY = `
ASSERTION STABILITY:
- Prefer toHaveTextContent() for dynamic text.
- Avoid brittle exact matches.
- Assert user-visible behavior.
`;

const AVOID_RULES = `
DO NOT:
- Mock next/image or next/link
- Add router/providers
- Over-mock imports
- Write complex setup
`;

const RUNTIME_AND_OUTPUT = `
RUNTIME & OUTPUT:
- Tests must run with npm test in jsdom.
- Must work with default Vite + React template.
- No unused imports.
- Output ONLY executable test code.
- First line = header comment.
- No markdown or explanations.
`;

export const CODE_PROMPT = `You are an expert in Jest and React Testing Library.

Generate beginner-friendly, reliable tests.

IMPORTS:
- @testing-library/react
- @testing-library/jest-dom
- @testing-library/user-event (REQUIRED when interactions exist; use userEvent.setup())

${FILE_PLACEMENT_RULES}
${HEADER_COMMENT_RULE}
${STACK_AND_IMPORTS}
${SIMPLE_MOCKING}
${TEST_FOCUS}
${BUTTON_NAME_RESILIENCE}
${QUERIES_AND_INTERACTIONS}
${USER_EVENT_AND_ASYNC_RULES}
${TEXT_MATCHING_STABILITY}
${ACCESSIBLE_NAME_STABILITY}
${ASSERTION_STABILITY}
${AVOID_RULES}
${RUNTIME_AND_OUTPUT}

Return ONLY the test file code.`;

export const COMPONENT_TEST_PROMPT = `You are an expert in Jest and React Testing Library.

Generate tests for the provided React component.

IMPORTS:
- @testing-library/react
- @testing-library/jest-dom
- @testing-library/user-event (use setup())

${FILE_PLACEMENT_RULES}
${HEADER_COMMENT_RULE}
${STACK_AND_IMPORTS}
${SIMPLE_MOCKING}
${TEST_FOCUS}
${BUTTON_NAME_RESILIENCE}
${QUERIES_AND_INTERACTIONS}
${USER_EVENT_AND_ASYNC_RULES}
${TEXT_MATCHING_STABILITY}
${ACCESSIBLE_NAME_STABILITY}
${ASSERTION_STABILITY}
${AVOID_RULES}
${RUNTIME_AND_OUTPUT}

Return ONLY the test file code.`;

export const REQUIREMENT_PROMPT = `You are an expert in JavaScript/TypeScript and Jest/RTL.

Write implementation + beginner-friendly tests.

${HEADER_COMMENT_RULE}
${STACK_AND_IMPORTS}
${USER_EVENT_AND_ASYNC_RULES}
${TEXT_MATCHING_STABILITY}
${ASSERTION_STABILITY}
${AVOID_RULES}
${RUNTIME_AND_OUTPUT}

Format EXACTLY:

---IMPLEMENTATION---
<implementation>

---TESTS---
<tests>
`;

export const STEPS_PROMPT_INSTRUCTION = `Generate steps.txt explaining how to install and run tests.

Works for React, Vite, CRA, Next.js, and TypeScript.

Include:
1. Purpose
2. Supported projects
3. Where to place files
4. Prerequisites
5. Install dependencies
6. Config files
7. package.json script
8. Run tests
9. Notes
10. Advanced tests

Plain text only.
`;

export type PromptKind = "code" | "component" | "requirement" | "steps";

export type BuildPromptResult = {
  prompt: string;
  isCode: boolean;
  kind: PromptKind;
};

export function buildStepsPrompt(
  testPaths: string[],
  rootFolder: string
): string {
  const pathList =
    testPaths.length > 0
      ? testPaths.map((p) => `  - ${p}`).join("\n")
      : "  (no paths)";

  return `${STEPS_PROMPT_INSTRUCTION}

CONTEXT:
- Root folder: ${rootFolder}
- Test files:
${pathList}

Generate steps.txt now.`;
}

export function buildPrompt(
  input: string,
  isCodeInput: boolean,
  mode?: "component" | "steps"
): BuildPromptResult {
  if (mode === "steps") {
    return { prompt: input, isCode: false, kind: "steps" };
  }

  if (mode === "component") {
    return {
      prompt: `${COMPONENT_TEST_PROMPT}

Component source:

${input}`,
      isCode: true,
      kind: "component",
    };
  }

  if (isCodeInput) {
    return {
      prompt: `${CODE_PROMPT}

Generate Jest tests for this code:

${input}`,
      isCode: true,
      kind: "code",
    };
  }

  return {
    prompt: `${REQUIREMENT_PROMPT}

Requirement:

${input}`,
    isCode: false,
    kind: "requirement",
  };
}