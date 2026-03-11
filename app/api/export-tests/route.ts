import { NextRequest, NextResponse } from "next/server";
import { PassThrough } from "stream";
import { Readable } from "stream";
import archiver from "archiver";
import { getTestZipEntryPath, normalizePath } from "@/lib/zipPaths";
import type { ZipInputMode } from "@/lib/zipPaths";
import { generateTestsWithFallback } from "@/lib/ai/router";
import { buildStepsPrompt } from "@/lib/ai/prompts";

const FILENAME = "generated-tests.zip";

/** Fallback steps.txt when LLM generation fails or no provider is configured. */
const FALLBACK_STEPS_TXT = `--------------------------------
PURPOSE
This file explains how to install dependencies and run the generated Jest test cases. The same setup works for: React (plain), React + Vite, Create React App (CRA), Next.js, and React + TypeScript projects.

SUPPORTED PROJECT TYPES
* React (plain)
* React + Vite
* Create React App (CRA)
* Next.js (client components; treat as standard React)
* React + TypeScript (.ts, .tsx)

WHERE TO PLACE THE EXTRACTED FILES
Extract the ZIP file. Place the extracted root folder as your project root OR merge its contents into your existing project root.

Example:
If the ZIP contains:

my-app/
  src/Button.test.jsx

Then either:

1. Use "my-app" as your main project folder, OR
2. Copy the contents inside "my-app" (such as src/) into your existing project root.

The folder structure must match so that test file paths and imports work without modification.

PREREQUISITES

* Node.js installed
* npm installed

You can verify installation by running:
node -v
npm -v

INSTALL DEPENDENCIES

Run this command inside your project root:

npm install --save-dev jest babel-jest @babel/preset-env @babel/preset-react @testing-library/react @testing-library/jest-dom @testing-library/user-event @testing-library/dom identity-obj-proxy jest-environment-jsdom

CONFIG FILES TO ADD

1. Create a file named: babel.config.cjs (in project root)
   If it does not exist, create it with this content:

module.exports = {
  presets: [
    ["@babel/preset-env", { targets: { node: "current" } }],
    ["@babel/preset-react", { runtime: "automatic" }]
  ],
};

2. Create a file named: jest.config.cjs (in project root)
   If it does not exist, create it with this content:

module.exports = {
  testEnvironment: "jsdom",

  transform: {
    "^.+\\\\.(js|jsx|ts|tsx)$": "babel-jest"
  },

  testPathIgnorePatterns: [
    "/node_modules/",
    "/dist/",
    "/build/",
    "/config/"
  ],

  moduleNameMapper: {
    "\\.(css|less|sass|scss)$": "identity-obj-proxy",
    "\\.(svg|png|jpg|jpeg|gif|webp|avif)$": "<rootDir>/src/__mocks__/fileMock.js",
    "^/vite.svg$": "<rootDir>/src/__mocks__/fileMock.js"
  },

  moduleFileExtensions: ["js", "jsx", "ts", "tsx"],

  setupFilesAfterEnv: ["<rootDir>/src/setupTests.js"]
};

3. Create asset mock file (required for Vite static files)

Create folder: src/__mocks__/
Inside it, create file: fileMock.js

Content:

module.exports = "test-file-stub";

4. Create Jest setup file

Create file: src/setupTests.js

Content:

import "@testing-library/jest-dom";

PACKAGE.JSON

Ensure your package.json contains:

"scripts": {
  "test": "jest"
}

If a test script already exists, replace it with the one above.

RUN TESTS

To run all tests:

npm test

To run a specific test file:

npm test -- src/App.test.jsx

NOTES

* jest-environment-jsdom is required for DOM testing.
* babel-jest enables JSX and modern JavaScript/TypeScript transformation. TypeScript is supported via Babel (no ts-jest required).
* CSS imports are mocked using identity-obj-proxy.
* Vite: Static files (SVG, images, avif) and paths like /vite.svg are mocked for compatibility with Vite config and asset handling. Use the provided moduleNameMapper and fileMock.js.
* Create React App (CRA): CRA may already include Jest and React Testing Library. If "npm test" already runs Jest, you may only need to add or adjust jest.config.cjs and setupFilesAfterEnv if your tests require it.
* Next.js: Generated tests treat Next.js components as standard React components. Client components and .tsx files are supported; the same Jest + Babel setup runs without Next-specific test runners.
* The setup does not modify your project structure.
* After completing these steps, generated test files should run without further configuration.

ADVANCED TESTS
If your generated tests include any of the following, this same setup supports them. Do not simplify or remove them:
* Mocked modules (jest.mock) — supported.
* Async tests (async/await, waitFor) — supported.
* Hooks and context usage — supported; mock only what would break in jsdom.
* API mocking (fetch, MSW, or jest.mock for API modules) — supported.
--------------------------------
`;

/**
 * Returns the path to a test file relative to the project root (ZIP root folder).
 * e.g. "react-app/src/Button.test.tsx" -> "src/Button.test.tsx"
 */
function getRelativeTestPath(zipPath: string, rootFolder: string): string {
  const normalized = zipPath.replace(/\\/g, "/");
  if (normalized.startsWith(rootFolder + "/")) {
    return normalized.slice(rootFolder.length + 1);
  }
  return normalized;
}

/**
 * Builds the JSDoc header comment for a generated test file.
 * Skipped if content already starts with this header (avoids duplicate on regeneration).
 */
function buildTestFileHeader(zipPath: string, rootFolder: string): string {
  const filename = zipPath.replace(/\\/g, "/").split("/").pop() ?? zipPath;
  const relativePath = getRelativeTestPath(zipPath, rootFolder);
  return `/**
 * Test File: ${filename}
 * Run this test:
 *   npx jest ${relativePath}
 * Ensure dependencies installed:
 *   npm install
 */
`;
}

export type ExportTestsBody = {
  files: Array<{ path: string; tests: string }>;
  inputMode?: ZipInputMode;
  /** Root folder in ZIP: GitHub = repo name, Local = uploaded folder name. Derived from first path when local and omitted. */
  rootFolderName?: string;
  /** Brain: use this conversation so steps.txt is generated in the same thread as component tests. */
  conversationId?: string | null;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ExportTestsBody;
    const files = Array.isArray(body?.files) ? body.files : [];
    const inputMode: ZipInputMode = body?.inputMode === "local" ? "local" : "github";
    let rootFolderName: string | undefined = body?.rootFolderName;

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No tests to export. Generate tests for one or more components first." },
        { status: 400 }
      );
    }

    if (rootFolderName == null) {
      const firstPath = files.find((f) => f.path && typeof f.path === "string")?.path;
      if (firstPath) {
        const firstSegment = normalizePath(firstPath).split("/").filter(Boolean)[0];
        if (firstSegment) rootFolderName = firstSegment;
      }
    }

    const seen = new Set<string>();
    const entries: Array<{ path: string; tests: string }> = [];

    for (const { path: repoPath, tests } of files) {
      if (!repoPath || typeof tests !== "string" || !tests.trim()) continue;
      const zipPath = getTestZipEntryPath(repoPath, { inputMode, rootFolderName });
      if (seen.has(zipPath)) continue;
      seen.add(zipPath);
      entries.push({ path: zipPath, tests: tests.trim() });
    }

    if (entries.length === 0) {
      return NextResponse.json(
        { error: "No valid tests to export." },
        { status: 400 }
      );
    }

    console.log("[export-tests] Archive paths (full relative paths):");
    for (const { path: zipPath } of entries) {
      console.log("[export-tests]   ", zipPath);
    }

    const rootFolder =
      rootFolderName ?? entries[0].path.replace(/\\/g, "/").split("/")[0] ?? "project";
    const stepsPath = `${rootFolder}/steps.txt`;

    const relativeTestPaths = entries.map((e) => getRelativeTestPath(e.path, rootFolder));
    const stepsPrompt = buildStepsPrompt(relativeTestPaths, rootFolder);
    const conversationId =
      typeof body.conversationId === "string" && body.conversationId.trim()
        ? body.conversationId.trim()
        : undefined;
    let stepsContent = FALLBACK_STEPS_TXT;
    let stepsConversationId: string | undefined;
    try {
      const stepsResult = await generateTestsWithFallback(stepsPrompt, {
        mode: "steps",
        conversationId: conversationId ?? undefined,
      });
      if (stepsResult.success && stepsResult.tests?.trim()) {
        stepsContent = stepsResult.tests.trim();
        stepsConversationId = stepsResult.conversationId;
        console.log("[export-tests] Using LLM-generated steps.txt");
      } else {
        console.log("[export-tests] Using fallback steps.txt (generation failed or empty)");
      }
    } catch (err) {
      console.warn("[export-tests] Steps generation failed, using fallback:", err);
    }

    const passThrough = new PassThrough();
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("error", (err) => {
      console.error("[export-tests] archiver error:", err);
      passThrough.destroy(err);
    });

    archive.pipe(passThrough);

    archive.append(Buffer.from(stepsContent, "utf-8"), { name: stepsPath });

    for (const { path: zipPath, tests } of entries) {
      const trimmed = tests.trimStart();
      const alreadyHasHeader =
        trimmed.startsWith("/**") && trimmed.includes("Test File:") && trimmed.includes("npx jest");
      const content = alreadyHasHeader ? tests : buildTestFileHeader(zipPath, rootFolder) + "\n" + tests;
      archive.append(Buffer.from(content, "utf-8"), { name: zipPath });
    }

    await archive.finalize();

    const webStream = Readable.toWeb(passThrough) as ReadableStream;

    const headers: Record<string, string> = {
      "Content-Type": "application/zip",
      "Content-Disposition": `attachment; filename="${FILENAME}"`,
    };
    if (stepsConversationId) {
      headers["X-Conversation-Id"] = stepsConversationId;
    }

    return new Response(webStream, {
      status: 200,
      headers,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[export-tests] Unexpected error:", message);
    return NextResponse.json(
      { error: "Failed to create ZIP. Please try again." },
      { status: 500 }
    );
  }
}
