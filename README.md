# NextJS Test Case Generator

Generate Jest + React Testing Library test cases from code or plain English requirements using the Gemini API.

## Features

- **Code or requirement input** — Paste JS/TS/React code or describe a requirement in plain English.
- **Gemini-powered** — Uses Google’s Gemini API to generate tests (and implementation when you provide a requirement).
- **Loading steps** — While generating, the UI shows progress steps: “Analyzing input…”, “Calling Gemini…”, “Formatting results…” for a more responsive feel.
- **Dark / light mode** — Toggle in the top-right; preference is saved in `localStorage`.
- **Let it snow** — Optional snowfall overlay with a toggle next to the theme switch. Snow fades in and out when turned on or off.

## Package installation

```bash
npm install
```

## Environment setup

1. Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Create `.env.local` in the project root and set:
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
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
  api/generate-tests/route.ts   # POST API: detects code vs requirement, calls Gemini
  globals.css                   # Theme CSS variables (light/dark), snowfall keyframes
  layout.tsx                    # Root layout, theme script, ThemeProvider, SnowAndControls
  page.tsx                      # Main UI: textarea, submit, loading steps, results
  Snow.tsx                      # Falling snow overlay (flakes, fade in/out)
  SnowAndControls.tsx           # Wraps app: snow toggle + theme toggle (top-right), children
  ThemeProvider.tsx              # Theme context + localStorage
  ThemeToggle.tsx                # Dark/light mode switch (used inside SnowAndControls)
lib/
  isCode.ts                     # Detects if input looks like code (e.g. function, import, JSX)
```

## Components

| Component         | Role |
|------------------|------|
| **ThemeProvider** | Provides theme state (light/dark) and persists to `localStorage`. |
| **SnowAndControls** | Layout wrapper: renders `Snow` (visibility from toggle), fixed top-right bar with “Let it snow” button and `ThemeToggle`, and page children. |
| **Snow**         | Full-viewport snow overlay. Accepts `active`; when `true` shows falling flakes with fade-in; when `false` fades out. Non-interactive (`pointer-events: none`). |
| **ThemeToggle**  | Button to switch between light and dark theme (used inside SnowAndControls' top-right bar). |
| **page.tsx**     | Home page: input textarea, generate button, loading steps, and display of implementation + generated test cases. |

For detailed component and API documentation, see **[COMPONENTS.md](./COMPONENTS.md)**.

## Usage

1. Paste **code** (Next.js/JS/TS/React) or a **requirement** (e.g. “generate test cases for a function that adds two numbers”) in the textarea.
2. Click **Generate Test Cases** — you’ll see loading steps (Analyzing input…, Calling Gemini…, Formatting results…) while the request runs.
3. View the generated test file (and implementation when you used a requirement) in the output section.
4. Use the **theme toggle** (top-right) to switch between dark and light mode; your choice is remembered on reload.
5. Click **Let it snow** (top-right, next to the theme toggle) to turn the snowfall overlay on or off; it fades in when enabled and fades out when disabled.
