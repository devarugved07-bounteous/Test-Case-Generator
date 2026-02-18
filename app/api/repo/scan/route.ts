import { NextRequest, NextResponse } from "next/server";
import {
  parseRepoUrl,
  fetchRepoTree,
  fetchDefaultBranch,
  filterComponentFiles,
  buildTreeFromFlatList,
} from "@/lib/github";
import type { ScanResult, ScanError } from "@/lib/types";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const url = typeof body.url === "string" ? body.url.trim() : "";
    if (!url) {
      return NextResponse.json(
        { success: false, error: "Repository URL is required." } as ScanError,
        { status: 400 }
      );
    }
    const repo = parseRepoUrl(url);
    if (!repo) {
      return NextResponse.json(
        {
          success: false,
          error: "Invalid GitHub URL. Use https://github.com/owner/repo or .../owner/repo/tree/branch",
        } as ScanError,
        { status: 400 }
      );
    }
    const token = process.env.GITHUB_TOKEN;
    let branch = repo.branch;
    if (!branch) {
      branch = await fetchDefaultBranch(repo.owner, repo.repo, token);
    }
    const tree = await fetchRepoTree(repo.owner, repo.repo, branch, token);
    const list = filterComponentFiles(tree);
    const builtTree = buildTreeFromFlatList(list);
    return NextResponse.json({
      success: true,
      tree: builtTree,
      list,
      repo: { owner: repo.owner, repo: repo.repo, branch },
    } as ScanResult);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const is404 = /not found|404/i.test(message);
    const isRateLimit = /rate limit|403/i.test(message);
    return NextResponse.json(
      {
        success: false,
        error: is404
          ? "Repository or branch not found."
          : isRateLimit
            ? "GitHub rate limit exceeded. Add GITHUB_TOKEN to .env.local for higher limits."
            : message,
      } as ScanError,
      { status: is404 ? 404 : isRateLimit ? 429 : 500 }
    );
  }
}
