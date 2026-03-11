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

// const HEADER_COMMENT_RULE = `
// HEADER COMMENT (REQUIRED):

// /**
//  * Test: <ComponentOrFunctionName>
//  * Path: <relative/path/to/TestFile.test.tsx>
//  * Run: npm test -- <relative/path/to/TestFile.test.tsx>
//  */

// - Use npm test (NEVER npx jest).
// - No explanations.
// `;

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

export const STEPS_PROMPT_INSTRUCTION = `You are an expert in Jest + React Testing Library setup. Generate the exact content for a plain-text file named steps.txt.

CRITICAL — CONFIG FILES MUST BE COMPLETE:
You MUST output the FULL, copy-paste-ready content for every config file. Do NOT use placeholders, "e.g.", or partial snippets. The user must be able to create each file by copying your output exactly.

Do NOT use preset: 'ts-jest'. Use babel-jest for ALL file types (.js, .jsx, .ts, .tsx). TypeScript is supported via Babel; no ts-jest required.

REQUIRED FILES (you must include full contents for each):
1. babel.config.cjs (project root) — full module.exports with presets: ["@babel/preset-env", { targets: { node: "current" } }] and ["@babel/preset-react", { runtime: "automatic" }].
2. jest.config.cjs (project root) — full module.exports with: testEnvironment "jsdom"; transform "^.+\\.(js|jsx|ts|tsx)$" -> "babel-jest"; testPathIgnorePatterns ["/node_modules/", "/dist/", "/build/", "/config/"]; moduleNameMapper with "\\.(css|less|sass|scss)$" -> "identity-obj-proxy", "\\.(svg|png|jpg|jpeg|gif|webp|avif)$" -> "<rootDir>/src/__mocks__/fileMock.js", "^/vite.svg$" -> "<rootDir>/src/__mocks__/fileMock.js"; moduleFileExtensions ["js","jsx","ts","tsx"]; setupFilesAfterEnv ["<rootDir>/src/setupTests.js"].
3. src/__mocks__/fileMock.js — REQUIRED ONLY IF NEEDED. Create folder src/__mocks__/ and file fileMock.js. Full content: module.exports = "test-file-stub";
4. src/setupTests.js — REQUIRED. This file is needed so Jest runs @testing-library/jest-dom before each test. Full content: import "@testing-library/jest-dom";

If you omit setupTests.js or fileMock.js, or give incomplete config, the tests will not run. Always include both with full contents.

SECTIONS (in order):
1. Purpose — This guide explains how to install dependencies and run tests. Works for React, Vite, CRA, Next.js, and TypeScript.
2. Supported projects — React, Vite, Create React App (CRA), Next.js, TypeScript.
3. Where to place files — Place test files alongside production files (e.g. src/app/layout.test.tsx next to src/app/layout.tsx). Or place extracted ZIP contents so folder structure matches.
4. Prerequisites — Node.js and npm (or yarn). Verify with node -v and npm -v.
5. Install dependencies — Full command: npm install --save-dev jest babel-jest @babel/preset-env @babel/preset-react @testing-library/react @testing-library/jest-dom @testing-library/user-event @testing-library/dom identity-obj-proxy jest-environment-jsdom. (yarn alternative if you want.)
6. Config files — For EACH of the 4 files above, write the exact file path and then the COMPLETE file content (every line). No code fences; plain text. User must be able to copy each block into the file as-is.
7. package.json script — "test": "jest". Note: CRA may already have Jest.
8. Run tests — npm test or npm test -- <path/to/test.file.tsx>. (yarn test if desired.)
9. Notes — setupTests.js is required for @testing-library/jest-dom. fileMock.js is required for Vite/assets. TypeScript works via Babel (no ts-jest). CRA may already include Jest. Next.js client components supported.
10. Advanced tests — Same setup supports mocked modules, async tests, hooks/context, API mocking. Do not simplify.

Use plain text only. No markdown code fences (no \`\`\`). Output ONLY the steps.txt content. Every config file must be shown in full.`;

export type PromptKind = "code" | "component" | "requirement" | "steps";

export type BuildPromptResult = {
  prompt: string;
  isCode: boolean;
  kind: PromptKind;
};

/** Reminder for continuation turns (no system prompt resend): output only test code. */
export const CONTINUATION_INSTRUCTION =
  "Generate Jest + React Testing Library tests for this component. Return ONLY the test file code — no markdown, no descriptions, no explanations based on previous prompts\n\n";

/** Split for Brain conversation: system (sent once) + user (sent each turn). When continuing a conversation, send only userPrompt with conversation_id. */
export type BuildPromptPartsResult = {
  systemPrompt: string | undefined;
  userPrompt: string;
  isCode: boolean;
  kind: PromptKind;
};

export function buildPromptParts(
  input: string,
  isCodeInput: boolean,
  mode?: "component" | "steps"
): BuildPromptPartsResult {
  if (mode === "steps") {
    return { systemPrompt: undefined, userPrompt: input, isCode: false, kind: "steps" };
  }
  if (mode === "component") {
    return {
      systemPrompt: COMPONENT_TEST_PROMPT,
      userPrompt: `Component source:\n\n${input}`,
      isCode: true,
      kind: "component",
    };
  }
  if (isCodeInput) {
    return {
      systemPrompt: CODE_PROMPT,
      userPrompt: `Generate Jest tests for this code:\n\n${input}`,
      isCode: true,
      kind: "code",
    };
  }
  return {
    systemPrompt: REQUIREMENT_PROMPT,
    userPrompt: `Requirement:\n\n${input}`,
    isCode: false,
    kind: "requirement",
  };
}

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
- Root folder in ZIP: ${rootFolder}
- Generated test file paths:
${pathList}

Remember: output FULL contents for babel.config.cjs, jest.config.cjs, src/__mocks__/fileMock.js, and src/setupTests.js. setupTests.js is required for @testing-library/jest-dom. Do not use ts-jest; use babel-jest.

Generate the complete steps.txt now.`;
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