import type { RepoInfo, TreeEntry, ComponentItem } from "./types";

const UI_EXTENSIONS = [".js", ".jsx", ".ts", ".tsx"];
const IGNORED_DIRS = new Set([
  "node_modules",
  "build",
  "dist",
  "out",
  ".next",
  "coverage",
  "__snapshots__",
  ".git",
]);
const TEST_PATTERNS = /\.(test|spec)\.(js|jsx|ts|tsx)$/i;

export function parseRepoUrl(url: string): RepoInfo | null {
  const trimmed = url.trim();
  const match = trimmed.match(
    /^https?:\/\/github\.com\/([^/]+)\/([^/]+?)(?:\/tree\/([^/]+))?(?:\/.*)?$/
  );
  if (!match) return null;
  const [, owner, repo, branch] = match;
  const repoName = repo.replace(/\.git$/, "");
  return {
    owner,
    repo: repoName,
    branch: branch || "", // use default branch
  };
}

export function isComponentFile(path: string): boolean {
  const lower = path.toLowerCase();
  const segments = path.split("/");
  for (const seg of segments) {
    if (IGNORED_DIRS.has(seg)) return false;
  }
  if (TEST_PATTERNS.test(path)) return false;
  return UI_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

export function getComponentName(path: string): string {
  const base = path.split("/").pop() ?? path;
  return base.replace(/\.(jsx?|tsx?)$/i, "") || base;
}

type TreeMap = Map<string, TreeEntry>;

function ensureFolder(
  map: TreeMap,
  path: string,
  name: string
): TreeEntry {
  const existing = map.get(path);
  if (existing) return existing;
  const entry: TreeEntry = {
    name,
    path,
    type: "folder",
    children: [],
  };
  map.set(path, entry);
  return entry;
}

export function buildTreeFromFlatList(list: ComponentItem[]): TreeEntry[] {
  if (list.length === 0) return [];
  const byPath = new Map<string, TreeEntry>();
  for (const item of list) {
    const parts = item.path.split("/");
    const fileName = parts.pop()!;
    let currentPath = "";
    for (let i = 0; i < parts.length; i++) {
      const segment = parts[i];
      currentPath = currentPath ? `${currentPath}/${segment}` : segment;
      ensureFolder(byPath, currentPath, segment);
    }
    byPath.set(item.path, {
      name: fileName,
      path: item.path,
      type: "file",
    });
  }
  function getChildren(parentPath: string): TreeEntry[] {
    const children: TreeEntry[] = [];
    for (const [path, entry] of Array.from(byPath.entries())) {
      if (path === parentPath) continue;
      const prefix = parentPath ? `${parentPath}/` : "";
      if (!path.startsWith(prefix)) continue;
      const rest = path.slice(prefix.length);
      if (rest.includes("/")) continue;
      children.push(entry);
    }
    return children.sort((a, b) => {
      const aIsFolder = a.type === "folder" ? 0 : 1;
      const bIsFolder = b.type === "folder" ? 0 : 1;
      if (aIsFolder !== bIsFolder) return aIsFolder - bIsFolder;
      return a.name.localeCompare(b.name);
    });
  }
  function toArray(entries: TreeEntry[]): TreeEntry[] {
    return entries.map((e) => ({
      ...e,
      children:
        e.type === "folder" && e.children?.length
          ? toArray(e.children)
          : e.type === "folder"
            ? toArray(getChildren(e.path))
            : undefined,
    }));
  }
  const rootPaths = new Set<string>();
  for (const path of Array.from(byPath.keys())) {
    const first = path.split("/")[0];
    if (first) rootPaths.add(first);
  }
  const rootEntries = Array.from(rootPaths).sort().map((name) => {
    const path = name;
    return byPath.get(path) ?? ensureFolder(byPath, path, name);
  });
  const roots = rootEntries.filter((e) => {
    const parts = e.path.split("/");
    return parts.length === 1;
  });
  return toArray(roots);
}

export async function fetchDefaultBranch(
  owner: string,
  repo: string,
  token?: string
): Promise<string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
    headers,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message || `Repo not found: ${owner}/${repo}`
    );
  }
  const data = (await res.json()) as { default_branch: string };
  return data.default_branch;
}

export async function fetchRepoTree(
  owner: string,
  repo: string,
  branch: string,
  token?: string
): Promise<{ path: string; type: string }[]> {
  let treeSha: string;
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3+json",
  };
  if (token) headers.Authorization = `Bearer ${token}`;

  if (!branch) {
    branch = await fetchDefaultBranch(owner, repo, token);
  }

  const branchRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/branches/${encodeURIComponent(branch)}`,
    { headers }
  );
  if (!branchRes.ok) {
    if (branchRes.status === 404)
      throw new Error(`Branch not found: ${branch}`);
    const err = await branchRes.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message || "Failed to fetch branch"
    );
  }
  const branchData = (await branchRes.json()) as {
    commit: { sha: string; commit: { tree: { sha: string } } };
  };
  treeSha = branchData.commit.commit?.tree?.sha ?? branchData.commit.sha;

  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/${treeSha}?recursive=1`,
    { headers }
  );
  if (!treeRes.ok) {
    const err = await treeRes.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message || "Failed to fetch tree"
    );
  }
  const treeData = (await treeRes.json()) as { tree: { path: string; type: string }[] };
  return treeData.tree || [];
}

export function filterComponentFiles(
  tree: { path: string; type: string }[]
): ComponentItem[] {
  const list: ComponentItem[] = [];
  for (const node of tree) {
    if (node.type !== "blob") continue;
    if (!isComponentFile(node.path)) continue;
    list.push({
      path: node.path,
      name: getComponentName(node.path),
    });
  }
  return list.sort((a, b) => a.path.localeCompare(b.path));
}

export async function fetchRawFile(
  owner: string,
  repo: string,
  branch: string,
  path: string,
  token?: string
): Promise<string> {
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.raw",
  };
  if (token) headers.Authorization = `Bearer ${token}`;
  const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`;
  const res = await fetch(url, { headers });
  if (!res.ok) {
    if (res.status === 404) throw new Error("File not found.");
    const err = await res.json().catch(() => ({}));
    throw new Error(
      (err as { message?: string }).message || "Failed to fetch file"
    );
  }
  return res.text();
}
