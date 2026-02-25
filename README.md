# UI Component Test Case Generator

Generate Jest + React Testing Library test cases for UI components from a **GitHub repository** or a **local project folder**. Select components, generate tests, and download a ZIP with test files plus an LLM-generated **steps.txt** (where to place the folder, npm packages, Jest/Babel config, run commands).

## Features

- **GitHub repo scanning** — Paste a repository URL; the app validates it and fetches contents via the GitHub API.
- **Local project upload** — Drag & drop or select a folder; reads component files, skipping `node_modules`, build dirs, and test files.
- **Component discovery** — Recursively scans for UI component files (`.js`, `.jsx`, `.ts`, `.tsx`), ignoring `node_modules`, build dirs, and test files.
- **Searchable list & tree** — Browse components in a folder tree or flat list with search by name or path.
- **Source preview** — Optionally preview a component’s raw source before generating tests.
- **Comprehensive test generation** — Uses **Bounteous Brain** first (if configured), then **Claude**, then **Gemini** fallback. Generates tests covering:
  - Unit (props, state, conditional logic)
  - Rendering (static/dynamic content, conditional UI)
  - Interactions (clicks, input, toggles, form submit)
  - DOM/state updates
  - Edge cases (empty data, null, errors, long content)
  - Accessibility (roles, labels, keyboard)
- **Output actions** — Copy, download a single `.test.tsx`, or **Download Tests (ZIP)** with all generated tests.
- **ZIP with steps.txt** — The ZIP includes an **LLM-generated steps.txt**: where to place the extracted folder, npm packages to install, config files (`jest.config.cjs`, `babel.config.cjs`), and how to run tests. Fallback steps used if LLM is unavailable.
- **Loading & errors** — Progress steps for scan and generate; clear errors for invalid URL, rate limits, or fetch failures; “no components found” state.
- **Dark / light mode** — Toggle in the top-right; preference saved in `localStorage`.
- **Let it snow** — Optional snowfall overlay (toggle next to theme switch).

## Package installation

```bash
npm install
```

## Environment setup

1. **AI providers (at least one required for test generation)**  
   Create `.env.local` in the project root. API keys are used only on the server; they are never sent to the frontend.

   - **Bounteous Brain (first)** — Set `BRAIN_API_KEY` to use your organization’s AI workspace first. Get a key and see the API docs at [Bounteous Brain – Chat completions](https://brain.bounteous.tools/docs/v1/chat-completions).
   - **Claude** — Set `CLAUDE_API_KEY` for direct Claude (used if Brain is not set or fails). Get a key from [Anthropic Console](https://console.anthropic.com/).
   - **Gemini (fallback)** — Set `GEMINI_API_KEY` for automatic fallback when Brain/Claude are unavailable. Get a key from [Google AI Studio](https://aistudio.google.com/app/apikey).

   The app tries **Bounteous Brain** first when `BRAIN_API_KEY` is set, then Claude, then Gemini. You can set one or more:

   ```
   BRAIN_API_KEY=your_brain_api_key_here
   CLAUDE_API_KEY=your_claude_api_key_here
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

2. **GitHub (optional but recommended)**  
   Without a token, GitHub allows 60 requests/hour. For higher limits (5,000/hour), create a [Personal Access Token](https://github.com/settings/tokens) and add:

   ```
   GITHUB_TOKEN=your_github_token_here
   ```

## How to run the project

- **Development**
  ```bash
  npm run dev
  ```
  Open [http://localhost:3000](http://localhost:3000).

  If the dev server hangs at “Starting…”, try:
  ```bash
  npm run dev:clean
  ```

- **Production**
  ```bash
  npm run build
  npm start
  ```

## Project structure

```
app/
  api/
    export-tests/route.ts    # POST: build ZIP of test files + LLM-generated steps.txt
    generate-tests/route.ts  # POST: generate tests (Brain → Claude → Gemini)
    repo/
      scan/route.ts          # POST: validate URL, fetch tree, return component list/tree (GitHub)
      file/route.ts          # GET: fetch raw file content by owner/repo/branch/path
  globals.css
  layout.tsx
  page.tsx                   # Main UI: GitHub/local, scan/upload, component list, preview, generate, ZIP download
  Snow.tsx
  SnowAndControls.tsx
  ThemeProvider.tsx
  ThemeToggle.tsx
lib/
  ai/
    types.ts                 # Provider interface, GenerateOptions (component | steps), GenerateResult
    prompts.ts                # Test prompts + STEPS_PROMPT / buildStepsPrompt for steps.txt
    normalize.ts              # Normalize model output for consistent UI
    router.ts                 # Brain → Claude → Gemini fallback; metadata
    providers/
      brain.ts                # Bounteous Brain provider (first)
      claude.ts               # Claude provider
      gemini.ts               # Gemini provider (fallback)
  componentDetection.ts       # looksLikeComponent (for local upload content filtering)
  github.ts                   # parseRepoUrl, fetchRepoTree, filterComponentFiles, buildTree, fetchRawFile
  localProject.ts             # parseUploadedFiles: tree, list, fileContents from File[]
  zipPaths.ts                 # getTestZipEntryPath (GitHub vs local), normalizePath, getTestFileName
  isCode.ts
  types.ts                    # RepoInfo, TreeEntry, ComponentItem, ScanResult
```

## Usage

**GitHub flow**
1. Enter a **GitHub repository URL** (e.g. `https://github.com/owner/repo` or `.../owner/repo/tree/branch`) and click **Scan repository**.
2. Wait for the scan (validating URL, fetching repo, scanning for components).

**Local flow**
1. **Drag & drop** a folder onto the upload area or **click to browse** and select a folder (Chrome/Edge support folder selection). The app reads `.js`, `.jsx`, `.ts`, `.tsx` and skips `node_modules`, build, and test files.

**Common**
3. Use the **search box** to filter by name or path; click a component in the list or tree to select it. Use checkboxes to select multiple; **Select All Components** to select everything.
4. Optionally check **Preview source code** to view the file content.
5. Click **Generate tests** (single), **Generate for N selected**, or **Generate all**. The AI (Brain, Claude, or Gemini) generates the test file; the provider used is shown next to the result.
6. Use **Copy**, **Download** (single `ComponentName.test.tsx`), or **Download Tests (ZIP)**. The ZIP includes all generated test files and a **steps.txt** (LLM-generated when possible) with where to place the folder, npm install, Jest/Babel config, and run commands.
7. Use the **theme toggle** (top-right) for dark/light mode; **Let it snow** for the snowfall overlay.

For detailed component and API documentation, see **[COMPONENTS.md](./COMPONENTS.md)**.
