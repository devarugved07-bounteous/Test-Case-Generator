# NextJS Test Case Generator

Generate Jest + React Testing Library test cases from code or plain English requirements using the Gemini API.

## Package installation

```bash
npm install
```

## Environment setup

1. Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey).
2. Edit `.env.local` and set:
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

## How to run the project

- **Development:**
  ```bash
  npm run dev
  ```
  Open [http://localhost:3000](http://localhost:3000).

- **Production build and run:**
  ```bash
  npm run build
  npm start
  ```

## Project structure

```
/app
  /api/generate-tests/route.ts   # POST API: detects code vs requirement, calls Gemini
  layout.tsx
  page.tsx
/lib
  isCode.ts                      # Detects if input is code (e.g. function, import, JSX)
```

## Usage

1. Paste **code** (Next.js/JS/TS/React) or a **requirement** (e.g. "generate test cases for a function that adds two numbers") in the textarea.
2. Click **Generate Test Cases**.
3. View the generated test file (and implementation when you used a requirement) in the output section.
