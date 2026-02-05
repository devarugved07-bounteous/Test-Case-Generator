import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { isCode } from "@/lib/isCode";

const CODE_PROMPT = `You are an expert in Jest and React Testing Library. The user will provide JavaScript/TypeScript/React code.

Tasks:
1. Analyze the code and identify whether it is a React component, API route, custom hook, or plain function.
2. Generate a complete test file using Jest and React Testing Library only.
3. Cover: happy path, edge cases, props, user events, and if applicable API responses/mocks.
4. Do not include any explanation or markdown. Return ONLY the test file code, ready to copy. Use describe/it blocks and proper imports.`;

const REQUIREMENT_PROMPT = `You are an expert in JavaScript/TypeScript and Jest/React Testing Library. The user will provide a plain English requirement (e.g. "generate test cases for a function that adds two numbers").

Tasks:
1. First write the implementation (function or component) that satisfies the requirement.
2. Then write a complete Jest test file (with React Testing Library if it's a component) for that implementation.
3. Format your response exactly as follows, with no other text before or after:
---IMPLEMENTATION---
[full implementation code here]
---TESTS---
[full test file code here]
4. Use only describe/it blocks and proper imports. No explanations.`;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userInput = typeof body.input === "string" ? body.input.trim() : "";

    if (!userInput) {
      return NextResponse.json(
        { error: "Input is required." },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY is not configured. Add it to .env.local." },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({ model: "models/gemini-flash-lite-latest" });

    const isCodeInput = isCode(userInput);
    const fullPrompt = isCodeInput
      ? `${CODE_PROMPT}\n\nGenerate Jest + React Testing Library tests for this code:\n\n${userInput}`
      : `${REQUIREMENT_PROMPT}\n\nRequirement:\n\n${userInput}`;

    const result = await model.generateContent(fullPrompt);
    const response = result.response;
    const text = response.text();

    if (!text) {
      return NextResponse.json(
        { error: "No response from Gemini. Try again." },
        { status: 502 }
      );
    }

    let output = text;
    let implementation: string | null = null;

    if (!isCodeInput && text.includes("---IMPLEMENTATION---") && text.includes("---TESTS---")) {
      const implMatch = text.match(/---IMPLEMENTATION---\s*([\s\S]*?)---TESTS---/);
      const testsMatch = text.match(/---TESTS---\s*([\s\S]*?)(?:\n*$)/);
      implementation = implMatch?.[1]?.trim() ?? null;
      output = testsMatch?.[1]?.trim() ?? text;
    }

    return NextResponse.json({
      success: true,
      isCode: isCodeInput,
      tests: output,
      implementation: implementation ?? undefined,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const isRateLimit = /quota|rate|429|resource_exhausted/i.test(message);
    return NextResponse.json(
      {
        error: isRateLimit
          ? "Gemini API rate limit or quota exceeded. Try again later."
          : `Generation failed: ${message}`,
      },
      { status: 500 }
    );
  }
}
