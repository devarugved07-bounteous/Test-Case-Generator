# NextJS Test Case Generator

Generate Jest + React Testing Library test cases from code or plain English requirements using the Gemini API.

## Features

- **Code or requirement input** — Paste JS/TS/React code or describe a requirement in plain English.
- **Gemini-powered** — Uses Google’s Gemini API to generate tests (and implementation when you provide a requirement).
- **Dark / light mode** — Toggle in the top-right; preference is saved in `localStorage`.

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
  globals.css                   # Theme CSS variables (light/dark)
  layout.tsx                    # Root layout, theme script, ThemeProvider
  page.tsx                      # Main UI: textarea, submit, results
  ThemeProvider.tsx             # Theme context + localStorage
  ThemeToggle.tsx               # Dark/light mode switch (top-right)
lib/
  isCode.ts                     # Detects if input looks like code (e.g. function, import, JSX)
```

## Usage

1. Paste **code** (Next.js/JS/TS/React) or a **requirement** (e.g. “generate test cases for a function that adds two numbers”) in the textarea.
2. Click **Generate Test Cases**.
3. View the generated test file (and implementation when you used a requirement) in the output section.
4. Use the **theme toggle** (top-right) to switch between dark and light mode; your choice is remembered on reload.
