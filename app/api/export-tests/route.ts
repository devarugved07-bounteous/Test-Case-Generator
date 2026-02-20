import { NextRequest, NextResponse } from "next/server";
import { PassThrough } from "stream";
import { Readable } from "stream";
import archiver from "archiver";
import { getTestZipEntryPath } from "@/lib/zipPaths";

const FILENAME = "generated-tests.zip";

export type ExportTestsBody = {
  files: Array<{ path: string; tests: string }>;
};

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as ExportTestsBody;
    const files = Array.isArray(body?.files) ? body.files : [];

    if (files.length === 0) {
      return NextResponse.json(
        { error: "No tests to export. Generate tests for one or more components first." },
        { status: 400 }
      );
    }

    const seen = new Set<string>();
    const entries: Array<{ path: string; tests: string }> = [];

    for (const { path: repoPath, tests } of files) {
      if (!repoPath || typeof tests !== "string" || !tests.trim()) continue;
      const zipPath = getTestZipEntryPath(repoPath);
      if (seen.has(zipPath)) continue;
      seen.add(zipPath);
      entries.push({ path: zipPath, tests: tests.trim() });
    }

    if (entries.length === 0) {
      return NextResponse.json(
        { error: "No valid tests to export." },
        { status: 400 }
      );
    }

    console.log("[export-tests] Archive paths (full relative paths):");
    for (const { path: zipPath } of entries) {
      console.log("[export-tests]   ", zipPath);
    }

    const passThrough = new PassThrough();
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("error", (err) => {
      console.error("[export-tests] archiver error:", err);
      passThrough.destroy(err);
    });

    archive.pipe(passThrough);

    for (const { path: zipPath, tests } of entries) {
      archive.append(Buffer.from(tests, "utf-8"), { name: zipPath });
    }

    await archive.finalize();

    const webStream = Readable.toWeb(passThrough) as ReadableStream;

    return new Response(webStream, {
      status: 200,
      headers: {
        "Content-Type": "application/zip",
        "Content-Disposition": `attachment; filename="${FILENAME}"`,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[export-tests] Unexpected error:", message);
    return NextResponse.json(
      { error: "Failed to create ZIP. Please try again." },
      { status: 500 }
    );
  }
}
