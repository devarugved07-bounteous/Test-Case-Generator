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
This file explains how to install dependencies and run the generated Jest test cases.

WHERE TO PLACE THE EXTRACTED FILES
Extract the ZIP and place the extracted folder (or merge its contents) into your application folder so that the directory structure matches. For example: if the ZIP contains a root folder (e.g. "my-app") with "src/Button.test.tsx" inside, place that root folder as your project root, or merge the contents of the root folder into your existing project root. This way test file paths and imports work without any path changes.

SETUP

1. Install dependencies:

npm install --save-dev jest babel-jest @babel/preset-env @babel/preset-react @testing-library/react @testing-library/jest-dom @testing-library/user-event identity-obj-proxy jest-environment-jsdom

2. Create babel.config.cjs (if missing) in project root:

module.exports = {
  presets: ["@babel/preset-env", "@babel/preset-react"],
};

3. Create jest.config.cjs (if missing) in project root:

module.exports = {
  testEnvironment: "jsdom",

  testPathIgnorePatterns: [
    "/node_modules/",
    "/dist/",
    "/build/",
    "vite.config",
    "babel.config",
    "jest.config",
    "eslint.config"
  ],

  transform: {
    "^.+\\.[jt]sx?$": "babel-jest"
  },

  moduleNameMapper: {
    "\\.(css|less|scss)$": "identity-obj-proxy"
  },

  moduleFileExtensions: ["js", "jsx", "ts", "tsx", "json"]
};

4. Ensure package.json contains:

"scripts": {
  "test": "jest"
}

5. Run tests:

npm test

NOTES
- jest-environment-jsdom is required for DOM testing.
- babel-jest enables JSX & modern JS transformation.
- CSS imports are mocked for Jest.
- The setup does not modify project structure.
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
    let stepsContent = FALLBACK_STEPS_TXT;
    try {
      const stepsResult = await generateTestsWithFallback(stepsPrompt, { mode: "steps" });
      if (stepsResult.success && stepsResult.tests?.trim()) {
        stepsContent = stepsResult.tests.trim();
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

    return new Response(webStream, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${FILENAME}"`,
      },
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
