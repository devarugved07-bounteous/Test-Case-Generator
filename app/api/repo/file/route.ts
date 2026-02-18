import { NextRequest, NextResponse } from "next/server";
import { fetchRawFile, fetchDefaultBranch } from "@/lib/github";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const owner = searchParams.get("owner");
    const repo = searchParams.get("repo");
    let branch = searchParams.get("branch");
    const path = searchParams.get("path");
    if (!owner || !repo || !path) {
      return NextResponse.json(
        { success: false, error: "Missing owner, repo, or path." },
        { status: 400 }
      );
    }
    const token = process.env.GITHUB_TOKEN;
    if (!branch) {
      branch = await fetchDefaultBranch(owner, repo, token);
    }
    const content = await fetchRawFile(owner, repo, branch, path, token);
    return NextResponse.json({ success: true, content });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json(
      { success: false, error: message },
      { status: 404 }
    );
  }
}
