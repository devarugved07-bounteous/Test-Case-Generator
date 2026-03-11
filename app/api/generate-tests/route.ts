import { NextRequest, NextResponse } from "next/server";
import { generateTestsWithFallback } from "@/lib/ai/router";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const userInput = typeof body.input === "string" ? body.input.trim() : "";
    const mode = body.mode === "component" ? "component" : undefined;
    const conversationId =
      body.conversationId !== undefined && body.conversationId !== null
        ? (typeof body.conversationId === "string" ? body.conversationId.trim() : null)
        : undefined;
    const componentIndexInConversation =
      typeof body.componentIndexInConversation === "number" && body.componentIndexInConversation >= 1
        ? body.componentIndexInConversation
        : undefined;

    if (!userInput) {
      return NextResponse.json(
        { error: "Input is required." },
        { status: 400 }
      );
    }

    const result = await generateTestsWithFallback(userInput, {
      mode,
      conversationId: conversationId ?? undefined,
      componentIndexInConversation,
    });

    if (!result.success) {
      const status =
        result.error.includes("No AI provider configured") ? 500 : 502;
      return NextResponse.json(
        {
          error: result.error,
          ...(result.metadata?.attemptedProviders && {
            metadata: { attemptedProviders: result.metadata.attemptedProviders },
          }),
        },
        { status }
      );
    }

    return NextResponse.json({
      success: true,
      isCode: result.isCode,
      tests: result.tests,
      implementation: result.implementation ?? undefined,
      metadata: { provider: result.metadata.provider },
      ...(result.conversationId && { conversationId: result.conversationId }),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[generate-tests] Unexpected error:", message);
    return NextResponse.json(
      {
        error: "Test generation failed. Please try again.",
      },
      { status: 500 }
    );
  }
}
