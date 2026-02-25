/**
 * Shared prompts for deterministic, production-ready test generation.
 * Ensures tests run directly with `npm test` in CRA, Next.js, Vite, or custom Jest setups.
 */

const FILE_PLACEMENT_RULES = `
FILE PLACEMENT:
- Place the test file beside its corresponding component.
- Maintain the existing project structure.
- Detect and use the correct relative path from project root.
- The header Path and Run command MUST match the actual file location.
`;

const HEADER_COMMENT_RULE = `
HEADER COMMENT (REQUIRED):
- Include a short header comment at the top of the file.

Format EXACTLY as:

/**
 * Test: <ComponentOrFunctionName>
 * Path: <relative/path/to/TestFile.test.tsx>
 * Run: npm test -- <relative/path/to/TestFile.test.tsx>
 */

- Use npm test (NEVER npx jest).
- Keep it minimal.
- Do NOT include explanations.
- Do NOT include dependency installation steps.
`;

const IMPORT_PATH_SAFETY = `
IMPORT & PATH SAFETY:
- Resolve correct relative path to the component.
- Match exact file name and casing.
- Support .js, .jsx, .ts, .tsx.
- Do NOT duplicate imports.
- Do NOT import React in React 17+ projects unless required.
`;

const CONTEXT_AND_HOOK_RULES = `
CONTEXT & HOOKS (CRITICAL):
- If component uses a custom hook (e.g. useTodos), mock the hook.
- Use: jest.mock('module', () => ({ hookName: jest.fn() }))
- Do NOT wrap components with Context.Provider unless explicitly required.
- Do NOT access Context.Provider directly.
- Store jest.fn() mocks in variables for stable assertions.
`;

const STABLE_TESTING_PRACTICES = `
STABLE TESTING PRACTICES:
- Prefer accessible queries: getByRole, getByLabelText, getByText.
- Avoid dynamic IDs and brittle selectors.
- Avoid implementation details.
- Use userEvent for interactions.
- Tests must remain stable after UI refactors.
`;

const RUNTIME_STABILITY_RULES = `
RUNTIME STABILITY:
- Tests must run without manual setup.
- Compatible with CRA (react-scripts), Next.js, Vite, custom Jest.
- Must pass in jsdom environment.
- Avoid unnecessary async.
- No unused imports.
- No console warnings.
`;

const STRICT_OUTPUT_RULES = `
STRICT OUTPUT RULES (ABSOLUTE):
- Output ONLY executable test code.
- First line MUST be the header comment.
- Do NOT include markdown, backticks, explanations, or extra text.
- Do NOT add anything before or after the test file.
- Must run directly with npm test without modification.
`;

const OUTPUT_QUALITY = `
OUTPUT QUALITY:
- Production-ready tests only.
- Clean, minimal, deterministic structure.
- Clear describe/it blocks.
- Proper mocking.
- No over-mocking.
- Tests must pass when executed.
`;

export const CODE_PROMPT = `You are an expert in Jest and React Testing Library.

The user will provide JavaScript/TypeScript/React code.

Tasks:
1. Detect whether the code is:
   - React component
   - Custom hook
   - API route
   - Plain function
2. Generate a complete Jest test file.
3. Cover:
   - Rendering
   - User interactions
   - Props behavior
   - Conditional rendering
   - Edge cases
4. Use descriptive test names.
5. Import from:
   - @testing-library/react
   - @testing-library/jest-dom
   - @testing-library/user-event (when interactions exist)
6. Mock CSS, assets, and external modules if present.

${FILE_PLACEMENT_RULES}
${HEADER_COMMENT_RULE}
${IMPORT_PATH_SAFETY}
${CONTEXT_AND_HOOK_RULES}
${STABLE_TESTING_PRACTICES}
${RUNTIME_STABILITY_RULES}
${STRICT_OUTPUT_RULES}
${OUTPUT_QUALITY}

Return ONLY the test file code.`;

export const COMPONENT_TEST_PROMPT = `You are an expert in Jest and React Testing Library.

The user will provide a React component (.jsx or .tsx).

Generate ONE complete test file.

Tests must cover:
- Rendering
- Interactions
- Props behavior
- Conditional rendering
- Edge cases

Use proper mocking patterns.

${FILE_PLACEMENT_RULES}
${HEADER_COMMENT_RULE}
${IMPORT_PATH_SAFETY}
${CONTEXT_AND_HOOK_RULES}
${STABLE_TESTING_PRACTICES}
${RUNTIME_STABILITY_RULES}
${STRICT_OUTPUT_RULES}
${OUTPUT_QUALITY}

Return ONLY the test file code.`;

export const REQUIREMENT_PROMPT = `You are an expert in JavaScript/TypeScript and Jest/React Testing Library.

The user will provide a plain English requirement.

Tasks:
1. Write the implementation.
2. Write a complete Jest test file.
3. Cover rendering, interactions, props, conditional rendering, edge cases.

${HEADER_COMMENT_RULE}
${IMPORT_PATH_SAFETY}
${CONTEXT_AND_HOOK_RULES}
${STABLE_TESTING_PRACTICES}
${RUNTIME_STABILITY_RULES}
${STRICT_OUTPUT_RULES}
${OUTPUT_QUALITY}

Format EXACTLY:

---IMPLEMENTATION---
<full implementation>

---TESTS---
<full test file>
`;

/** Instructions for the LLM to generate steps.txt (setup and run instructions for the user). */
export const STEPS_PROMPT_INSTRUCTION = `You are an expert in JavaScript/TypeScript testing setup. Generate the exact content for a plain-text file named steps.txt that will be bundled in a ZIP with generated Jest + React Testing Library test files.

The steps.txt must give the user clear, copy-paste-ready instructions to run the tests. Include the following sections in order:

1. PURPOSE — One short paragraph: this file explains how to install dependencies and run the generated Jest test cases.

2. WHERE TO PLACE THE EXTRACTED FILES — Clear instructions so tests run without path changes:
   - Tell the user to extract the ZIP and place the extracted folder (or its contents) in their application folder so that the directory structure matches.
   - Example: if the ZIP has a root folder like "my-app" with "my-app/src/Button.test.tsx" inside, the user should either (a) extract so that "my-app" becomes their project root, or (b) merge the contents of "my-app" (e.g. the "src" folder and the test files) into their existing project root. That way test file paths and imports work without modification.
   - State explicitly: place the extracted root folder as your project root (or merge its contents into your project root) so that relative paths in the test files match your app structure.

3. PREREQUISITES — Node.js and npm (or yarn) installed.

4. INSTALL DEPENDENCIES — Exact npm install command listing all required dev dependencies:
   - jest, babel-jest, @babel/preset-env, @babel/preset-react
   - @testing-library/react, @testing-library/jest-dom, @testing-library/user-event
   - identity-obj-proxy, jest-environment-jsdom
   (Include any other packages commonly needed for React/JSX Jest setups if relevant.)

5. CONFIG FILES TO ADD — Tell the user to create these files in the project root if missing:
   - babel.config.cjs — show the full contents (presets: @babel/preset-env, @babel/preset-react).
   - jest.config.cjs — show the full contents: testEnvironment "jsdom", transform with babel-jest, testPathIgnorePatterns for node_modules/dist/build/config files, moduleNameMapper for CSS (identity-obj-proxy), moduleFileExtensions.

6. PACKAGE.JSON — Ensure "scripts" includes "test": "jest".

7. RUN TESTS — How to run all tests (e.g. npm test) and optionally how to run a single test file (e.g. npm test -- path/to/File.test.tsx).

8. NOTES — Short bullets: jest-environment-jsdom for DOM testing, babel-jest for JSX, CSS mocked via identity-obj-proxy.

Use clear section headers (e.g. PURPOSE, WHERE TO PLACE THE EXTRACTED FILES, PREREQUISITES, INSTALL DEPENDENCIES, CONFIG FILES TO ADD, RUN TESTS, NOTES). Use plain text only — no Markdown, no code fences. Output ONLY the steps.txt content so it can be written directly to a file.`;

export type PromptKind = "code" | "component" | "requirement" | "steps";

export type BuildPromptResult = {
  prompt: string;
  isCode: boolean;
  kind: PromptKind;
};

/**
 * Build the full prompt for generating steps.txt content.
 * Used when exporting tests to ZIP; the LLM generates setup/run instructions.
 */
export function buildStepsPrompt(testPaths: string[], rootFolder: string): string {
  const pathList =
    testPaths.length > 0
      ? testPaths.map((p) => `  - ${p}`).join("\n")
      : "  (no paths)";
  return `${STEPS_PROMPT_INSTRUCTION}

CONTEXT:
- Root folder in the ZIP: ${rootFolder}
- Generated test file paths (relative to project root):
${pathList}

Generate the complete steps.txt content now.`;
}

export function buildPrompt(
  input: string,
  isCodeInput: boolean,
  mode?: "component" | "steps"
): BuildPromptResult {
  if (mode === "steps") {
    return {
      prompt: input,
      isCode: false,
      kind: "steps",
    };
  }

  if (mode === "component") {
    return {
      prompt: `${COMPONENT_TEST_PROMPT}\n\nComponent source:\n\n${input}`,
      isCode: true,
      kind: "component",
    };
  }

  if (isCodeInput) {
    return {
      prompt: `${CODE_PROMPT}\n\nGenerate Jest tests for this code:\n\n${input}`,
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