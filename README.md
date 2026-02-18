# UI Component Test Case Generator

Generate Jest + React Testing Library test cases for UI components by scanning a GitHub repository. Paste a repo URL, select a component, and get comprehensive unit, rendering, interaction, DOM, edge-case, and accessibility tests.

## Features

- **GitHub repo scanning** — Paste a repository URL; the app validates it and fetches contents via the GitHub API.
- **Component discovery** — Recursively scans for UI component files (`.js`, `.jsx`, `.ts`, `.tsx`), ignoring `node_modules`, build dirs, and test files.
- **Searchable list & tree** — Browse components in a folder tree or flat list with search by name or path.
- **Source preview** — Optionally preview a component’s raw source before generating tests.
- **Comprehensive test generation** — Uses Claude by default with automatic Gemini fallback. Generates tests covering:
  - Unit (props, state, conditional logic)
  - Rendering (static/dynamic content, conditional UI)
  - Interactions (clicks, input, toggles, form submit)
  - DOM/state updates
  - Edge cases (empty data, null, errors, long content)
  - Accessibility (roles, labels, keyboard)
- **Output actions** — Copy, download (`.test.tsx`), or regenerate the generated tests.
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

   - **Claude (primary)** — Set `CLAUDE_API_KEY` to use Claude first for test generation. Get a key from [Anthropic Console](https://console.anthropic.com/).
   - **Gemini (fallback)** — Set `GEMINI_API_KEY` for automatic fallback when Claude is unavailable (missing key, auth error, rate limit, timeout, or service error). Get a key from [Google AI Studio](https://aistudio.google.com/app/apikey).

   The app tries Claude first when `CLAUDE_API_KEY` is set; if that fails or the key is missing, it uses Gemini. You can set both, or only one:

   ```
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
    generate-tests/route.ts   # POST: generate tests (Claude first, Gemini fallback)
    repo/
      scan/route.ts          # POST: validate URL, fetch tree, return component list/tree
      file/route.ts          # GET: fetch raw file content by owner/repo/branch/path
  globals.css
  layout.tsx
  page.tsx                   # Main UI: repo URL, scan, component list, preview, generate, output
  Snow.tsx
  SnowAndControls.tsx
  ThemeProvider.tsx
  ThemeToggle.tsx
lib/
  ai/
    types.ts                 # Provider interface, GenerateOptions, GenerateResult
    prompts.ts               # Shared prompts (code, component, requirement)
    normalize.ts             # Normalize model output for consistent UI
    router.ts                # Claude-first fallback to Gemini; logging & metadata
    providers/
      claude.ts              # Claude provider (default)
      gemini.ts              # Gemini provider (fallback)
  github.ts                  # parseRepoUrl, fetchRepoTree, filterComponentFiles, buildTree, fetchRawFile
  isCode.ts
  types.ts                   # RepoInfo, TreeEntry, ComponentItem, ScanResult
```

## Usage

1. Enter a **GitHub repository URL** (e.g. `https://github.com/owner/repo` or `.../owner/repo/tree/branch`) and click **Scan repository**.
2. Wait for the scan (validating URL, fetching repo, scanning for components).
3. Use the **search box** to filter by name or path; click a component in the list or tree to select it.
4. Optionally check **Preview source code** to view the file content.
5. Click **Generate tests** — progress steps run while the AI (Claude or Gemini) generates the test file. The provider used is shown next to the result for debugging.
6. Use **Copy**, **Download** (saves as `ComponentName.test.tsx`), or **Regenerate** on the result.
7. Use the **theme toggle** (top-right) for dark/light mode; **Let it snow** for the snowfall overlay.

For detailed component and API documentation, see **[COMPONENTS.md](./COMPONENTS.md)**.
