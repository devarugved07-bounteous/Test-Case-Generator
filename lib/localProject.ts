import {
  isComponentFile,
  getComponentName,
  buildTreeFromFlatList,
} from "./github";
import type { TreeEntry, ComponentItem } from "./types";

function normalizeRelativePath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\/+|\/+$/g, "");
}

export type LocalProjectResult = {
  tree: TreeEntry[];
  list: ComponentItem[];
  fileContents: Record<string, string>;
};

export type ParseUploadProgressCallback = (loaded: number, total: number) => void;

/**
 * Parse uploaded files (e.g. from input multiple or directory picker).
 * Keeps directory hierarchy from file paths, filters to component extensions,
 * and returns tree, flat list, and path -> content map.
 * Optionally reports progress via onProgress(loaded, total).
 */
export async function parseUploadedFiles(
  files: File[],
  onProgress?: ParseUploadProgressCallback
): Promise<LocalProjectResult> {
  const pathSet = new Set<string>();
  const eligible: { file: File; path: string }[] = [];

  for (const file of files) {
    const path = normalizeRelativePath(
      (file as File & { webkitRelativePath?: string }).webkitRelativePath || file.name
    );
    if (!path || pathSet.has(path)) continue;
    if (!isComponentFile(path)) continue;
    pathSet.add(path);
    eligible.push({ file, path });
  }

  const total = eligible.length;
  const fileContents: Record<string, string> = {};

  for (let i = 0; i < eligible.length; i++) {
    const { file, path } = eligible[i];
    try {
      const text = await file.text();
      fileContents[path] = text;
    } catch {
      fileContents[path] = "";
    }
    onProgress?.(i + 1, total);
    // Yield so React can flush state and the browser can paint live progress
    await new Promise<void>((r) => requestAnimationFrame(() => r()));
    await new Promise((r) => setTimeout(r, 0));
  }

  const list: ComponentItem[] = Array.from(pathSet)
    .sort((a, b) => a.localeCompare(b))
    .map((path) => ({ path, name: getComponentName(path) }));

  const tree = buildTreeFromFlatList(list);

  return { tree, list, fileContents };
}
