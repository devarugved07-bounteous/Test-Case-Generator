# UI Component Test Generator – Component Documentation

This document describes what each part of the application does.

---

## 1. `app/layout.tsx` (Root Layout)

**Role:** Wraps every page in the app. Defines the HTML shell, theme initialization, and global structure.

**What it does:**
- Sets the document structure: `<html lang="en" suppressHydrationWarning>` and `<body>`.
- Imports **`globals.css`** for theme CSS variables and base body styles.
- Defines **metadata** (title: “UI Component Test Generator”, description) used for the browser tab and SEO.
- Injects an inline **theme script** in `<head>` that runs before paint: reads `localStorage.getItem("theme")` or `prefers-color-scheme`, then sets `document.documentElement.setAttribute("data-theme", "light"|"dark")` to avoid a flash of wrong theme.
- Wraps the app in **`ThemeProvider`** and **`SnowAndControls`**; `SnowAndControls` renders the snow overlay (when on), the fixed top-right bar (Let it snow + theme toggle), and `{children}` so each page (e.g. `page.tsx`) is shown inside the layout.

**When it runs:** On every request; the layout is shared across all pages.

---

## 2. `app/page.tsx` (Home / Main UI)

**Role:** The main screen. Handles **GitHub repo URL** or **local folder upload**, repository scanning / file parsing, component selection (single + multi-select), source preview, and test generation with copy/download single file, batch download as ZIP (with LLM-generated steps.txt), and regenerate.

**What it does:**

| Part | Purpose |
|------|--------|
| **Source kind** | `sourceKind`: `"github"` \| `"local"` \| `null`. Local: `localFileContents` from `parseUploadedFiles` (lib/localProject). |
| **Repo state (GitHub)** | `repoUrl`, `scanning`, `scanStep` (0–2), `scanError`, `repo` (owner/repo/branch), `tree`, `list` (flat component list). |
| **Upload (local)** | `handleUpload` / `handleDrop`: `parseUploadedFiles` sets `tree`, `list`, `localFileContents`; `uploadError` if no components. File contents live only in `localFileContents` (in-memory); nothing is stored on the server. |
| **Multi-select state** | `selectedPaths` (array of paths), `generatedTests` (record path → test string), `generatingAll`, `downloadZipFeedback`. `togglePathSelection(path)` and `isPathSelected(path)` manage checkbox selection. |
| **Scan form** | URL input and “Scan repository” button. On submit, `handleScan` POSTs to `/api/repo/scan` with `{ url }`, then sets `repo`, `tree`, `list` or `scanError`; also clears `selectedPaths`, `generatedTests`, etc. |
| **Scan steps** | When `scanning` is true, a card shows “Validating URL…”, “Fetching repository…”, “Scanning for components…” with ✓ / ⋯ / ○. |
| **Component list** | Search input filters by name/path. When search is empty: **tree view** (folders + files via `renderTree`). When searching: **flat list** of matching components. Each row has a checkbox for multi-select and a ✓ when tests are generated. Click row to set `selectedPath`. |
| **Selection & preview** | “Preview source code” checkbox toggles `previewOpen`. When on, fetches raw file via `/api/repo/file` and shows it in a `<pre>`. |
| **Generate (single)** | “Generate tests” button calls `handleGenerate`: loads file content (if needed), POSTs to `/api/generate-tests` with `{ input: content, mode: "component" }`, then sets `tests` and updates `generatedTests[selectedPath]`. |
| **Generate selected** | When at least one path is selected, "Generate for N selected" calls `handleGenerateSelected`: for each selected path, fetches file and POSTs to `/api/generate-tests`, storing results in `generatedTests`; if only one, also sets `tests` and `selectedPath`. |
| **Generate all** | "Generate all" calls `handleGenerateAll`: iterates over full `list`, fetches each file and generates tests, storing in `generatedTests`. |
| **Generate steps** | When `generating` or `generatingAll` is true, a card shows “Analyzing component…”, “Calling AI…”, “Formatting tests…”. |
| **Output** | “Generated test cases” section shows current `tests` (for selected component). Copy, Download (saves single file as `ComponentName.test.tsx`), "Download Tests (ZIP)" (all generated), and Regenerate. Displays `metadata.provider` (e.g. "via claude") when present. |
| **Download ZIP** | `handleDownloadTests` POSTs to `/api/export-tests` with `{ files, inputMode, rootFolderName? }`. ZIP includes test files + **steps.txt** (LLM-generated on server). |
| **Empty / errors** | “No UI components found” when scan succeeds but list is empty. Scan and generation errors shown in styled blocks using `--error-bg`, `--error-border`, `--error-text`. |

**When it runs:** In the browser when the user visits the home page. It is a Client Component (`"use client"`) so it can use `useState`, `useEffect`, and event handlers.

---

## 3. `app/api/repo/scan/route.ts` (Scan Repository API)

**Role:** Validates a GitHub repo URL, fetches the repository tree via the GitHub API, filters to UI component files, and returns a folder tree plus flat list.

**What it does:**

| Step | Description |
|------|-------------|
| **1. Parse request** | Reads body `url` (string). Returns 400 if missing or if `parseRepoUrl(url)` returns null (invalid URL). |
| **2. Resolve branch** | If URL had no branch, calls `fetchDefaultBranch(owner, repo, token)` (1 request). Otherwise uses branch from URL. |
| **3. Fetch tree** | Calls `fetchRepoTree(owner, repo, branch, token)` (branch + recursive tree; 2 requests). |
| **4. Filter** | `filterComponentFiles(tree)` keeps only `.js`, `.jsx`, `.ts`, `.tsx` blobs, excluding paths under `node_modules`, `build`, `dist`, etc., and `*.test.*` / `*.spec.*`. |
| **5. Build tree** | `buildTreeFromFlatList(list)` turns the flat list into a nested `TreeEntry[]` grouped by folder. |
| **6. Respond** | Returns `{ success: true, tree, list, repo: { owner, repo, branch } }`. On error (404, rate limit, network), returns 400/404/429/500 with `{ success: false, error }`; rate limit message suggests adding `GITHUB_TOKEN`. |

**When it runs:** When the user clicks “Scan repository” and the front end sends POST to `/api/repo/scan`. Uses `GITHUB_TOKEN` from env if set for higher rate limits.

---

## 4. `app/api/repo/file/route.ts` (Fetch File Content API)

**Role:** Fetches the raw content of a single file from a GitHub repository.

**What it does:**
- **Query params:** `owner`, `repo`, `branch`, `path`. Returns 400 if any are missing.
- If `branch` is missing, calls `fetchDefaultBranch(owner, repo, token)` to resolve it.
- Calls `fetchRawFile(owner, repo, branch, path, token)` (GitHub Contents API with `Accept: application/vnd.github.raw`).
- Returns `{ success: true, content }` or `{ success: false, error }` with 404 on file not found.

**When it runs:** When the user enables “Preview source code” or when generating tests (to load component source). Uses `GITHUB_TOKEN` from env if set.

---

## 5. `app/api/generate-tests/route.ts` (Generate Tests API)

**Role:** Receives code or a requirement (or component source with `mode: "component"`), calls the AI router (`lib/ai/router`), and returns generated Jest + React Testing Library tests (and optionally implementation for requirement-based flow). The router tries **Bounteous Brain** first (if `BRAIN_API_KEY` is set), then **Claude**, then **Gemini** fallback.

**What it does:**

| Step | Description |
|------|-------------|
| **1. Parse request** | Reads body `input` (string) and optional `mode` (`"component"` \| `"steps"`). Returns 400 if input is missing. |
| **2. Call router** | Calls `generateTestsWithFallback(userInput, { mode })` from `@/lib/ai/router`. Router returns a friendly error if no provider is configured. |
| **3. Respond** | On success: `{ success: true, isCode, tests, implementation?, metadata: { provider: "brain" \| "claude" \| "gemini" } }`. On failure: 500/502 with `{ error, metadata?: { attemptedProviders } }`. |

**When it runs:** When the front end sends POST to `/api/generate-tests` (e.g. “Generate tests” from the GitHub flow with component source, or any future “paste code” flow).

---

## 5b. `app/api/export-tests/route.ts` (Export Tests as ZIP API)

**Role:** Builds a ZIP archive of generated test files plus an LLM-generated **steps.txt** (or fallback), and returns it for download. Preserves directory structure via `lib/zipPaths`.

**What it does:**
- **Request:** POST with body `{ files: Array<{ path: string, tests: string }>, inputMode?: "github" | "local", rootFolderName?: string }`. Each `path` is the repo/file path; `tests` is the generated test content. `inputMode` and `rootFolderName` determine ZIP root and path mapping (see `lib/zipPaths`).
- **Validation:** Returns 400 if `files` is missing or empty, or if no valid entries (path + non-empty tests).
- **Steps.txt:** Computes relative test paths and root folder. Calls `buildStepsPrompt(relativeTestPaths, rootFolder)` from `lib/ai/prompts`, then `generateTestsWithFallback(stepsPrompt, { mode: "steps" })` from `lib/ai/router`. The LLM returns plain-text instructions for: **where to place the extracted folder** in the user's app (so tests run without path changes), **npm packages** to install, **config files** (e.g. `jest.config.cjs`, `babel.config.cjs`) to add, and **how to run** tests. If generation fails or no provider is configured, a **fallback steps.txt** is used (same sections, including "WHERE TO PLACE THE EXTRACTED FILES").
- **ZIP building:** Uses `archiver`. Appends `steps.txt` at `{rootFolder}/steps.txt`, then each test file via `getTestZipEntryPath(repoPath, { inputMode, rootFolderName })`. Deduplicates by zip path. Adds a short header to test file content if missing. Streams the ZIP to the response.
- **Response:** 200 with `Content-Type: application/zip` and `Content-Disposition: attachment; filename="generated-tests.zip"`. On error, returns 500 with `{ error }`.

**When it runs:** When the user clicks "Download Tests (ZIP)" on the main page after generating tests for one or more components.

---

## 6. `lib/github.ts` (GitHub API Helpers)

**Role:** URL parsing, repository tree fetching, file filtering, tree building, and raw file fetching. All GitHub requests use optional `GITHUB_TOKEN` for higher rate limits.

**What it does:**

| Function | Purpose |
|----------|--------|
| **parseRepoUrl(url)** | Regex: `https?://github.com/([^/]+)/([^/]+?)(/tree/([^/]+))?`. Returns `{ owner, repo, branch }` or null. Strips `.git` from repo name. |
| **isComponentFile(path)** | Returns true for `.js`/`.jsx`/`.ts`/`.tsx`; false if path contains `node_modules`, `build`, `dist`, `out`, `.next`, `coverage`, `__snapshots__`, `.git`, or matches `*.test.*`/`*.spec.*`. |
| **getComponentName(path)** | Basename without extension (e.g. `Button` from `src/Button.tsx`). |
| **buildTreeFromFlatList(list)** | Builds a nested `TreeEntry[]` (folders with `children`, file leaves) from a flat list of paths. |
| **fetchDefaultBranch(owner, repo, token?)** | `GET /repos/{owner}/{repo}`, returns `default_branch`. |
| **fetchRepoTree(owner, repo, branch, token?)** | If branch empty, fetches default. Then `GET .../branches/{branch}` for tree SHA, then `GET .../git/trees/{sha}?recursive=1` for full tree. Returns array of `{ path, type }`. |
| **filterComponentFiles(tree)** | Keeps only `type === "blob"` and `isComponentFile(path)`; returns sorted `ComponentItem[]` (`path`, `name`). |
| **fetchRawFile(owner, repo, branch, path, token?)** | `GET .../contents/{path}?ref={branch}` with `Accept: application/vnd.github.raw`; returns response text. |

**When it runs:** Used only by the API routes (`/api/repo/scan`, `/api/repo/file`); never in the browser.

---

## 6a. `lib/localProject.ts` (Local Project Upload)

**Role:** Parses uploaded files (folder or multiple files) into a tree, flat component list, and path → content map. Used when the user uploads a local project instead of scanning GitHub.

**What it does:** `parseUploadedFiles(files, onProgress?)` reads `File[]` (e.g. from an input with `webkitdirectory` or multi-file). Each file’s path comes from `file.webkitRelativePath` (folder structure preserved). Uses `isComponentFile(path)` from `lib/github` to filter; builds `tree` via `buildTreeFromFlatList`, `list` (flat `ComponentItem[]`), and `fileContents: Record<string, string>` by reading each file with `file.text()` in the browser. Optionally reports progress via `onProgress(loaded, total)`.

**Where content is stored:** File contents are **not** sent to the server at upload time. They are kept only in **browser memory**: the page stores the returned `fileContents` in React state as `localFileContents`. The server receives file content only when the user triggers **Generate tests** or **Download Tests (ZIP)** (sent in the request body; not persisted on the server).

**When it runs:** Called from `app/page.tsx` in `handleUpload` when the user selects or drops a folder.

---

## 6a2. `lib/componentDetection.ts` (Component Content Detection)

**Role:** Detects whether file content looks like a React/UI component (for optional content-based filtering on local uploads).

**What it does:** `looksLikeComponent(content, extension)` returns true if the file extension is `.tsx`/`.jsx`/`.ts`/`.js` and the content has both a default export and component-like patterns (e.g. `export default function`, JSX, React class, hooks). Uses `DEFAULT_EXPORT_PATTERNS` and `REACT_COMPONENT_PATTERNS` regexes.

**When it runs:** Available for use when filtering local uploads; GitHub flow uses extension-only filtering in `lib/github`.

---

## 6a3. `lib/ai/prompts.ts` (Prompts and Steps.txt Generation)

**Role:** Shared prompts for test generation (code, component, requirement) and for **steps.txt** content when exporting the ZIP.

**What it does:**
- **Test prompts:** `CODE_PROMPT`, `COMPONENT_TEST_PROMPT`, `REQUIREMENT_PROMPT`; rules for file placement, header comment, imports, context/hooks, stable testing, strict output. `buildPrompt(input, isCodeInput, mode?)` returns `{ prompt, isCode, kind }`. When `mode === "steps"`, returns `{ prompt: input, isCode: false, kind: "steps" }` (input is the full steps prompt).
- **Steps.txt:** `STEPS_PROMPT_INSTRUCTION` tells the LLM to generate plain-text steps with: PURPOSE, WHERE TO PLACE THE EXTRACTED FILES, PREREQUISITES, INSTALL DEPENDENCIES, CONFIG FILES TO ADD (babel.config.cjs, jest.config.cjs), PACKAGE.JSON, RUN TESTS, NOTES. `buildStepsPrompt(testPaths, rootFolder)` returns the full prompt string with context (root folder name and list of test file paths) for the export route.

**When it runs:** Test prompts used by all AI providers when generating tests; steps prompt used by `app/api/export-tests/route.ts` before calling the router with `mode: "steps"`.

---

## 6b. `lib/ai/router.ts` (AI Test Generation Router)

**Role:** Orchestrates test generation (and steps.txt generation when `mode: "steps"`) with provider fallback. Tries **Bounteous Brain** first (if `BRAIN_API_KEY` is set), then **Claude**, then **Gemini**. Used by `app/api/generate-tests/route.ts` and `app/api/export-tests/route.ts`.

**What it does:** `generateTestsWithFallback(input, options?)` calls Brain → Claude → Gemini; on failure (auth, rate limit, timeout, etc.) falls back to the next. Returns `{ success: true, tests, implementation?, metadata: { provider: "brain" | "claude" | "gemini" } }` or `{ success: false, error, metadata?: { attemptedProviders } }`. When `options.mode === "steps"`, the `input` is the full steps prompt and the raw response is returned as `tests` (no ---TESTS--- parsing). Prompts and providers live in `lib/ai/prompts.ts` and `lib/ai/providers/` (brain.ts, claude.ts, gemini.ts).

---

## 6c. `lib/zipPaths.ts` (ZIP Entry Paths for Test Files)

**Role:** Maps repository or local file paths to ZIP entry paths so the exported archive preserves directory structure. Used by `app/api/export-tests/route.ts`.

**What it does:** `getTestZipEntryPath(repoPath, options)` takes `inputMode: "github" | "local"` and optional `rootFolderName`. **GitHub:** uses repo name (or `rootFolderName`) as ZIP root; entry path is e.g. `repo-name/src/components/Button.test.tsx`. **Local:** paths already include the uploaded folder; entry path preserves structure (e.g. `my-app/src/components/Button.test.tsx`). `normalizePath(path)`, `getTestFileName(repoPath)` (e.g. `Button.tsx` → `Button.test.tsx`) are helpers.

---

## 7. `lib/types.ts` (Shared Types)

**Role:** TypeScript types for the GitHub scan flow and API responses.

**What it does:**
- **RepoInfo** — `{ owner: string; repo: string; branch: string }`.
- **TreeEntry** — `{ name: string; path: string; type: "file" | "folder"; children?: TreeEntry[] }`.
- **ComponentItem** — `{ path: string; name: string }`.
- **ScanResult** — `{ success: true; tree: TreeEntry[]; list: ComponentItem[]; repo: RepoInfo }`.
- **ScanError** — `{ success: false; error: string }`.

**When it runs:** Compile-time only; used by `lib/github.ts`, scan route, and `page.tsx`.

---

## 8. `lib/isCode.ts` (Helper – Input Detection)

**Role:** Decides whether the user’s input should be treated as **code** or as a **plain English requirement** (used when `mode` is not `"component"`).

**What it does:**
- Trims the input. Returns `false` if it’s empty.
- Takes only the **first 20 lines** to avoid scanning huge pastes.
- Runs a list of **regex patterns** (`CODE_INDICATORS`) on that text. If any pattern matches, it returns `true` (code); otherwise `false` (requirement).

**Patterns (examples):**  
`function`, `return`, `import ... from`, `export`, `=>`, JSX tags, `const x = (`, `class`, `interface`, `type`, template literals with `${}`, `await`, `async function`, file extensions like `.tsx`, and React hooks.

**When it runs:** In `app/api/generate-tests/route.ts` when building the prompt and `mode` is not `"component"`.

---

## 9. `app/globals.css` (Global Styles & Theme Variables)

**Role:** Defines theme-aware CSS variables and base body styles for light and dark mode.

**What it does:**
- **`:root` / `[data-theme="dark"]`** — Sets variables for dark theme: `--bg`, `--bg-elevated`, `--text`, `--text-muted`, `--border`, `--accent`, `--code-bg`, `--code-text`, `--error-*`, `--toggle-track`, `--toggle-thumb`, etc.
- **`[data-theme="light"]`** — Overrides the same variables with light-theme values.
- **`body`** — Applies `background-color: var(--bg)`, `color: var(--text)`, system font, `min-height: 100vh`, zero margin.
- **`@keyframes snowfall`** — Used by `Snow.tsx`: animates flakes from top to bottom with a slight horizontal drift.

The theme is switched by changing `data-theme` on `<html>`. All themed UI uses these variables.

**When it runs:** Loaded once by the root layout; variables apply globally.

---

## 10. `app/ThemeProvider.tsx` (Theme Context)

**Role:** Provides the current theme (light/dark) and methods to change it; syncs with `localStorage` and the DOM.

**What it does:**
- **Context** — Exposes `{ theme, setTheme, toggleTheme }` via `ThemeContext`. `useTheme()` throws if used outside the provider.
- **Initial theme** — On mount, reads `localStorage.getItem("theme")` or falls back to `prefers-color-scheme`; defaults to `"dark"` on the server.
- **Sync** — When `theme` or `mounted` changes, sets `document.documentElement.setAttribute("data-theme", theme)` and `localStorage.setItem("theme", theme)`.

**When it runs:** Client-only (`"use client"`). Wraps the app in `layout.tsx`; any child can call `useTheme()`.

---

## 11. `app/SnowAndControls.tsx` (Snow + Top-Right Controls)

**Role:** Layout wrapper that provides the optional snow overlay and the fixed top-right control bar (Let it snow + theme toggle).

**What it does:**
- **State** — `snowOn` (boolean) controls whether the snow overlay is visible; default `false`.
- **Snow** — Always renders **`Snow`** with `active={snowOn}` so snow fades in/out when toggled.
- **Fixed bar** — A `position: fixed` div at top-right containing “Let it snow” button and **`ThemeToggle`**.
- **Children** — Renders `{children}` (page content) below the overlay and controls.

**When it runs:** Client-only (`"use client"`). Renders inside `ThemeProvider` in `layout.tsx`; wraps all page content.

---

## 12. `app/Snow.tsx` (Snow Overlay)

**Role:** Full-viewport falling snow overlay. Visibility and fade are controlled by the `active` prop.

**What it does:**
- **Props** — `active: boolean`. When `true`, overlay is visible (opacity 1); when `false`, opacity 0. Uses a ~1.4s ease-in-out transition.
- **Flakes** — Renders a fixed number of “snowflakes” with random position, size, duration, delay, opacity; each uses the `snowfall` keyframe from `globals.css`.
- **Non-interactive** — Container has `pointer-events: none` and high `zIndex`. Root has `aria-hidden`.

**When it runs:** Always mounted by `SnowAndControls`; visibility toggled via `active`.

---

## 13. `app/ThemeToggle.tsx` (Theme Switch Button)

**Role:** Renders a button that toggles between light and dark mode. Used inside `SnowAndControls`’ top-right bar.

**What it does:**
- Uses **`useTheme()`** from `ThemeProvider` to get `theme` and `toggleTheme`.
- Renders a **button** with `aria-label` and `title`; shows an icon (☀️ / 🌙) and track/thumb styling using theme variables.

**When it runs:** Renders inside `SnowAndControls`; toggling updates context, `data-theme`, and `localStorage`.

---

## 14. Config and environment files

| File | Purpose |
|------|--------|
| **`package.json`** | App name, scripts (`dev`, `build`, `start`, `lint`), dependencies (Next.js, React, `@google/generative-ai`, TypeScript types). |
| **`tsconfig.json`** | TypeScript options: strict mode, path alias `@/*`, Next.js plugin. |
| **`next.config.js`** | Next.js configuration. |
| **`.env.local`** | At least one AI key required for test generation: `BRAIN_API_KEY` (first), `CLAUDE_API_KEY`, and/or `GEMINI_API_KEY` (fallback). Optional: `GITHUB_TOKEN` for higher GitHub API rate limits. Not committed (see `.gitignore`). |
| **`.gitignore`** | Excludes `node_modules`, `.next`, `.env*.local`, and other generated or sensitive files. |

---

## 15. Request flow (end-to-end)

**GitHub flow:**
1. User enters a GitHub repo URL on `app/page.tsx` and clicks **Scan repository**.
2. Front end sends **POST /api/repo/scan** with `{ url }`.
3. **Scan route** parses URL, fetches branch + recursive tree via **lib/github.ts** (using `GITHUB_TOKEN` if set). Filters to UI components, builds tree, returns `{ tree, list, repo }`.
4. **Page** shows a searchable tree/list with checkboxes; user selects one or more components (and optionally previews source via **GET /api/repo/file**).
5. User clicks **Generate tests** (or "Generate for N selected" / "Generate all"). Page loads file content (local or via `/api/repo/file`), then sends **POST /api/generate-tests** with `{ input: content, mode: "component" }`.
6. **Generate-tests route** calls **lib/ai/router** (`generateTestsWithFallback`): tries Brain → Claude → Gemini; returns `{ tests, metadata: { provider } }`.
7. **Page** shows Copy, Download (single file), **Download Tests (ZIP)**, Regenerate. **Download Tests (ZIP)** sends **POST /api/export-tests** with `{ files, inputMode, rootFolderName? }`. **Export route** builds steps.txt by calling `buildStepsPrompt` and `generateTestsWithFallback(..., { mode: "steps" })` (or uses fallback steps), then streams a ZIP containing `steps.txt` + all test files; user downloads `generated-tests.zip`.

**Local flow:**
1. User drags/drops a folder or selects a folder (input uses `webkitdirectory`); **page** calls `parseUploadedFiles` from **lib/localProject**, which reads each file with `file.text()` in the browser and returns `tree`, `list`, `fileContents`. Page sets `tree`, `list`, `localFileContents` (in-memory only), `sourceKind: "local"`. No content is stored on the server at upload time.
2. Same selection, generate, and download steps as above; file content is read from `localFileContents`; export sends `inputMode: "local"` and derives `rootFolderName` from the first path segment.

Theme and snow are independent: layout script and **ThemeProvider** set `data-theme`; **ThemeToggle** (in **SnowAndControls**) updates theme and persistence; **SnowAndControls** toggles the snow overlay.

---

## 16. Folder structure (reference)

```
app/
  globals.css              → Theme CSS variables (light/dark), body styles, @keyframes snowfall
  layout.tsx                → Root layout (HTML, metadata, theme script, ThemeProvider, SnowAndControls)
  page.tsx                  → Main UI: GitHub/local, scan/upload, component list/tree, preview, generate (single/selected/all), output + Download ZIP (steps.txt in ZIP)
  Snow.tsx                  → Falling snow overlay (active prop, fade in/out)
  SnowAndControls.tsx       → Wrapper: Snow + fixed top-right bar (Let it snow + ThemeToggle) + children
  ThemeProvider.tsx         → Theme context, useTheme, localStorage + data-theme sync
  ThemeToggle.tsx           → Dark/light mode switch (inside SnowAndControls bar)
  api/
    generate-tests/route.ts → POST: input + mode → lib/ai/router (Brain → Claude → Gemini) → tests + metadata.provider
    export-tests/route.ts   → POST: { files, inputMode, rootFolderName? } → LLM steps.txt + ZIP stream (lib/zipPaths)
    repo/
      scan/route.ts         → POST: validate URL, fetch tree, filter components, return tree + list
      file/route.ts         → GET: fetch raw file content (owner, repo, branch, path)
lib/
  ai/
    prompts.ts              → Test prompts; STEPS_PROMPT_INSTRUCTION, buildStepsPrompt (steps.txt)
    router.ts               → generateTestsWithFallback: Brain → Claude → Gemini; mode "steps" for steps.txt
    providers/              → brain.ts, claude.ts, gemini.ts
    types.ts, normalize.ts
  componentDetection.ts     → looksLikeComponent(content, extension)
  github.ts                 → parseRepoUrl, fetchRepoTree, filterComponentFiles, buildTreeFromFlatList, fetchRawFile
  localProject.ts           → parseUploadedFiles: tree, list, fileContents from File[]
  zipPaths.ts               → getTestZipEntryPath(path, { inputMode, rootFolderName }), normalizePath, getTestFileName
  isCode.ts                 → Detects code vs requirement from input string
  types.ts                  → RepoInfo, TreeEntry, ComponentItem, ScanResult, ScanError
```

Config and env at project root: `package.json`, `tsconfig.json`, `next.config.js`, `.env.local` (BRAIN_API_KEY, CLAUDE_API_KEY, GEMINI_API_KEY, GITHUB_TOKEN), `.gitignore`.
