"use client";

import { useState, useEffect, useCallback } from "react";
import type { RepoInfo, TreeEntry, ComponentItem, ScanResult } from "@/lib/types";
import { parseUploadedFiles } from "@/lib/localProject";

const SCAN_STEPS = ["Validating URL…", "Fetching repository…", "Scanning for components…"];
const GENERATE_STEPS = ["Analyzing component…", "Calling AI…", "Formatting tests…"];
const STEP_INTERVAL_MS = 1500;

type SourceKind = "github" | "local" | null;

const MAX_COMPONENTS_PER_CONVERSATION = 10;

type GenerateResult = {
  success: true;
  tests: string;
  implementation?: string;
  metadata?: { provider: string };
  conversationId?: string;
};

function isReactFile(path: string): boolean {
  const lower = path.toLowerCase();
  return lower.endsWith(".tsx") || lower.endsWith(".jsx");
}

export default function Home() {
  const [sourceKind, setSourceKind] = useState<SourceKind>(null);
  const [repoUrl, setRepoUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [scanError, setScanError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [repo, setRepo] = useState<RepoInfo | null>(null);
  const [tree, setTree] = useState<TreeEntry[]>([]);
  const [list, setList] = useState<ComponentItem[]>([]);
  const [localFileContents, setLocalFileContents] = useState<Record<string, string>>({});
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState("");
  const [selectedPath, setSelectedPath] = useState<string | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [sourceContent, setSourceContent] = useState<string | null>(null);
  const [sourceLoading, setSourceLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genStep, setGenStep] = useState(0);
  const [genError, setGenError] = useState<string | null>(null);
  const [tests, setTests] = useState<string | null>(null);
  const [providerUsed, setProviderUsed] = useState<string | null>(null);
  const [copyFeedback, setCopyFeedback] = useState(false);
  const [downloadFeedback, setDownloadFeedback] = useState(false);
  const [generatedTests, setGeneratedTests] = useState<Record<string, string>>({});
  const [selectedPaths, setSelectedPaths] = useState<string[]>([]);
  const [downloadZipFeedback, setDownloadZipFeedback] = useState(false);
  const [generatingAll, setGeneratingAll] = useState(false);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [componentCountInConversation, setComponentCountInConversation] = useState(0);
  const FEEDBACK_RESET_MS = 2000;

  function togglePathSelection(path: string) {
    setSelectedPaths((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  }

  function isPathSelected(path: string) {
    return selectedPaths.includes(path);
  }

  function selectAllComponents() {
    setSelectedPaths(list.map((item) => item.path));
  }

  function toggleFolder(path: string) {
    setExpandedFolders((prev) => {
      const next = new Set(prev);
      if (next.has(path)) next.delete(path);
      else next.add(path);
      return next;
    });
  }

  useEffect(() => {
    if (!scanning) return;
    setScanStep(0);
    const id = setInterval(
      () => setScanStep((s) => Math.min(s + 1, SCAN_STEPS.length - 1)),
      STEP_INTERVAL_MS
    );
    return () => clearInterval(id);
  }, [scanning]);

  useEffect(() => {
    if (!generating) return;
    setGenStep(0);
    const id = setInterval(
      () => setGenStep((s) => Math.min(s + 1, GENERATE_STEPS.length - 1)),
      STEP_INTERVAL_MS
    );
    return () => clearInterval(id);
  }, [generating]);

  function getAllFolderPaths(entries: TreeEntry[]): Set<string> {
    const out = new Set<string>();
    function walk(es: TreeEntry[]) {
      for (const e of es) {
        if (e.type === "folder") {
          out.add(e.path);
          if (e.children?.length) walk(e.children);
        }
      }
    }
    walk(entries);
    return out;
  }

  useEffect(() => {
    if (tree.length > 0) setExpandedFolders(getAllFolderPaths(tree));
  }, [tree]);

  const filteredList = search.trim()
    ? list.filter(
        (item) =>
          item.path.toLowerCase().includes(search.toLowerCase()) ||
          item.name.toLowerCase().includes(search.toLowerCase())
      )
    : list;

  function clearProject() {
    setRepo(null);
    setTree([]);
    setList([]);
    setLocalFileContents({});
    setSourceKind(null);
    setSelectedPath(null);
    setSelectedPaths([]);
    setSourceContent(null);
    setTests(null);
    setGenError(null);
    setProviderUsed(null);
    setCopyFeedback(false);
    setDownloadFeedback(false);
    setGeneratedTests({});
    setExpandedFolders(new Set());
    setConversationId(null);
    setComponentCountInConversation(0);
  }

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    setScanError(null);
    setUploadError(null);
    clearProject();
    if (!repoUrl.trim()) {
      setScanError("Please enter a GitHub repository URL.");
      return;
    }
    setScanning(true);
    try {
      const res = await fetch("/api/repo/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: repoUrl.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setScanError((data as { error?: string }).error ?? "Scan failed.");
        return;
      }
      const result = data as ScanResult;
      setSourceKind("github");
      setRepo(result.repo);
      setTree(result.tree);
      setList(result.list);
    } catch {
      setScanError("Network or server error. Try again.");
    } finally {
      setScanning(false);
    }
  }

  async function handleUpload(files: FileList | null) {
    setUploadError(null);
    setScanError(null);
    if (!files?.length) return;
    setUploading(true);
    setUploadProgress(0);
    clearProject();
    try {
      const fileArray = Array.from(files);
      const { tree: t, list: l, fileContents } = await parseUploadedFiles(
        fileArray,
        (loaded, total) => {
          setUploadProgress(total > 0 ? Math.round((loaded / total) * 100) : 0);
        }
      );
      setUploadProgress(100);
      if (l.length === 0) {
        setUploadError("No component files (.js, .jsx, .ts, .tsx) found. We skip node_modules, build, dist, and test files.");
        return;
      }
      setSourceKind("local");
      setTree(t);
      setList(l);
      setLocalFileContents(fileContents);
    } catch {
      setUploadError("Failed to read uploaded files. Try again.");
    } finally {
      setUploading(false);
      setUploadProgress(null);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
    handleUpload(e.dataTransfer?.files ?? null);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  const loadSource = useCallback(async () => {
    if (!selectedPath) return;
    if (sourceKind === "local") {
      setSourceContent(localFileContents[selectedPath] ?? "(File not in upload.)");
      return;
    }
    if (!repo) return;
    setSourceLoading(true);
    setSourceContent(null);
    try {
      const params = new URLSearchParams({
        owner: repo.owner,
        repo: repo.repo,
        branch: repo.branch,
        path: selectedPath,
      });
      const res = await fetch(`/api/repo/file?${params}`);
      const data = await res.json();
      if (res.ok && data.content != null) setSourceContent(data.content);
      else setSourceContent("(Could not load file.)");
    } catch {
      setSourceContent("(Failed to load file.)");
    } finally {
      setSourceLoading(false);
    }
  }, [sourceKind, repo, selectedPath, localFileContents]);

  useEffect(() => {
    if (previewOpen && selectedPath) {
      if (sourceKind === "local") setSourceContent(localFileContents[selectedPath] ?? "(File not in upload.)");
      else if (repo) loadSource();
    }
  }, [previewOpen, selectedPath, repo, sourceKind, localFileContents, loadSource]);

  async function handleGenerate() {
    if (!selectedPath) return;
    setGenError(null);
    setTests(null);
    setProviderUsed(null);
    setCopyFeedback(false);
    setDownloadFeedback(false);
    let content: string;
    if (sourceKind === "local") {
      content = localFileContents[selectedPath] ?? "";
    } else {
      if (!repo) return;
      content = sourceContent ?? "";
      if (content === "(Could not load file.)" || content === "(Failed to load file.)" || !content.trim()) {
        setSourceLoading(true);
        try {
          const params = new URLSearchParams({
            owner: repo.owner,
            repo: repo.repo,
            branch: repo.branch,
            path: selectedPath,
          });
          const res = await fetch(`/api/repo/file?${params}`);
          const data = await res.json();
          content = res.ok ? data.content : "";
        } catch {
          content = "";
        }
        setSourceLoading(false);
      }
    }
    if (!content?.trim()) {
      setGenError("Could not load component source. Try again.");
      return;
    }
    setGenerating(true);
    try {
      const startNewConversation = componentCountInConversation >= MAX_COMPONENTS_PER_CONVERSATION;
      const res = await fetch("/api/generate-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          input: content,
          mode: "component",
          conversationId: startNewConversation ? null : conversationId,
          componentIndexInConversation: startNewConversation ? 1 : componentCountInConversation + 1,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setGenError((data as { error?: string }).error ?? "Generation failed.");
        return;
      }
      const result = data as GenerateResult;
      const testContent = result.tests ?? "";
      setTests(testContent);
      setProviderUsed(result.metadata?.provider ?? null);
      if (result.conversationId) setConversationId(result.conversationId);
      if (startNewConversation) setComponentCountInConversation(1);
      else setComponentCountInConversation((c) => c + 1);
      if (testContent) {
        setGeneratedTests((prev) => ({ ...prev, [selectedPath]: testContent }));
      }
    } catch {
      setGenError("Network or server error. Try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function getContentForPath(path: string): Promise<string> {
    if (sourceKind === "local") return localFileContents[path] ?? "";
    if (!repo) return "";
    const params = new URLSearchParams({
      owner: repo.owner,
      repo: repo.repo,
      branch: repo.branch,
      path,
    });
    const res = await fetch(`/api/repo/file?${params}`);
    const data = await res.json();
    return res.ok && typeof data.content === "string" ? data.content : "";
  }

  async function handleGenerateSelected() {
    if (selectedPaths.length === 0) return;
    setGenError(null);
    setGenerating(true);
    const paths = [...selectedPaths];
    let lastTests: string | null = null;
    let lastPath: string | null = null;
    let currentConversationId = conversationId;
    let count = componentCountInConversation;
    try {
      for (const path of paths) {
        const content = await getContentForPath(path);
        if (!content?.trim()) continue;
        const startNewConversation = count >= MAX_COMPONENTS_PER_CONVERSATION;
        const res = await fetch("/api/generate-tests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input: content,
            mode: "component",
            conversationId: startNewConversation ? null : currentConversationId,
            componentIndexInConversation: startNewConversation ? 1 : count + 1,
          }),
        });
        const data = await res.json();
        if (res.ok && data.success && data.tests) {
          setGeneratedTests((prev) => ({ ...prev, [path]: data.tests }));
          lastTests = data.tests;
          lastPath = path;
          if (data.conversationId) {
            currentConversationId = data.conversationId;
            setConversationId(data.conversationId);
          }
          count = startNewConversation ? 1 : count + 1;
          setComponentCountInConversation(count);
        }
      }
      if (paths.length === 1 && lastPath && lastTests) {
        setSelectedPath(lastPath);
        setTests(lastTests);
      }
    } catch {
      setGenError("Some tests failed to generate. Try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleGenerateAll() {
    if (list.length === 0) return;
    setGenError(null);
    setGeneratingAll(true);
    let currentConversationId = conversationId;
    let count = componentCountInConversation;
    try {
      for (const item of list) {
        const content = await getContentForPath(item.path);
        if (!content?.trim()) continue;
        const startNewConversation = count >= MAX_COMPONENTS_PER_CONVERSATION;
        const res = await fetch("/api/generate-tests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            input: content,
            mode: "component",
            conversationId: startNewConversation ? null : currentConversationId,
            componentIndexInConversation: startNewConversation ? 1 : count + 1,
          }),
        });
        const data = await res.json();
        if (res.ok && data.success && data.tests) {
          setGeneratedTests((prev) => ({ ...prev, [item.path]: data.tests }));
          if (data.conversationId) {
            currentConversationId = data.conversationId;
            setConversationId(data.conversationId);
          }
          count = startNewConversation ? 1 : count + 1;
          setComponentCountInConversation(count);
        }
      }
    } catch {
      setGenError("Some tests failed to generate. Try again.");
    } finally {
      setGeneratingAll(false);
    }
  }

  async function handleDownloadTests() {
    const entries = Object.entries(generatedTests);
    if (entries.length === 0) {
      setGenError("No tests to download. Generate tests first.");
      return;
    }
    const inputMode: "github" | "local" = sourceKind === "local" ? "local" : "github";
    const rootFolderName =
      sourceKind === "github" && repo
        ? repo.repo
        : sourceKind === "local" && entries[0]?.[0]
          ? entries[0][0].replace(/\\/g, "/").split("/").filter(Boolean)[0]
          : undefined;
    setDownloadZipFeedback(true);
    setGenError(null);
    try {
      const res = await fetch("/api/export-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: entries.map(([path, tests]) => ({ path, tests })),
          inputMode,
          ...(rootFolderName && { rootFolderName }),
          conversationId: conversationId ?? undefined,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = (data as { error?: string }).error ?? "Download failed.";
        setGenError(msg);
        return;
      }
      const nextConversationId = res.headers.get("X-Conversation-Id");
      if (nextConversationId) setConversationId(nextConversationId);
      const blob = await res.blob();
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = "generated-tests.zip";
      a.click();
      URL.revokeObjectURL(a.href);
      setTimeout(() => setDownloadZipFeedback(false), FEEDBACK_RESET_MS);
    } catch {
      setGenError("Failed to download ZIP. Try again.");
      setDownloadZipFeedback(false);
    }
  }

  function handleCopy() {
    if (!tests) return;
    navigator.clipboard.writeText(tests).then(() => {
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), FEEDBACK_RESET_MS);
    });
  }

  function handleDownload() {
    if (!tests) return;
    const name = selectedPath?.split("/").pop()?.replace(/\.(jsx?|tsx?)$/i, "") ?? "Component";
    const blob = new Blob([tests], { type: "text/plain" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${name}.test.tsx`;
    a.click();
    URL.revokeObjectURL(a.href);
    setDownloadFeedback(true);
    setTimeout(() => setDownloadFeedback(false), FEEDBACK_RESET_MS);
  }

  function renderTree(entries: TreeEntry[], depth: number): React.ReactNode {
    return entries.map((entry) => {
      if (entry.type === "file") {
        const isSelected = selectedPath === entry.path;
        const isChecked = isPathSelected(entry.path);
        const hasGenerated = entry.path in generatedTests;
        const isReact = isReactFile(entry.path);
        return (
          <div
            key={entry.path}
            role="button"
            tabIndex={0}
            onClick={(e) => {
              if ((e.target as HTMLElement).closest('input[type="checkbox"]')) return;
              setSelectedPath(entry.path);
            }}
            onKeyDown={(e) => e.key === "Enter" && setSelectedPath(entry.path)}
            style={{
              padding: "6px 12px",
              paddingLeft: 12 + depth * 16,
              cursor: "pointer",
              borderRadius: 6,
              backgroundColor: isSelected ? "var(--accent)" : "transparent",
              color: isSelected ? "#fff" : "var(--text)",
              fontSize: 13,
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <input
              type="checkbox"
              checked={isChecked}
              onChange={(e) => {
                e.stopPropagation();
                togglePathSelection(entry.path);
              }}
              onClick={(e) => e.stopPropagation()}
              aria-label={`Select ${entry.name}`}
            />
            {hasGenerated && (
              <span style={{ fontSize: 12, opacity: 0.9 }} title="Test generated">✓</span>
            )}
            <span style={isReact ? { color: "var(--accent)", fontWeight: 500 } : undefined}>
              {entry.name}
            </span>
            <span style={{ opacity: 0.8, fontSize: 12 }}>{entry.path}</span>
          </div>
        );
      }
      const children = entry.children ?? [];
      const isExpanded = expandedFolders.has(entry.path);
      return (
        <div key={entry.path}>
          <div
            role="button"
            tabIndex={0}
            onClick={() => toggleFolder(entry.path)}
            onKeyDown={(e) => e.key === "Enter" && toggleFolder(entry.path)}
            style={{
              padding: "4px 12px",
              paddingLeft: 12 + depth * 16,
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-muted)",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 6,
            }}
          >
            <span style={{ width: 16, display: "inline-block" }}>{isExpanded ? "▼" : "▶"}</span>
            {entry.name}/
          </div>
          {isExpanded && children.length > 0 && renderTree(children, depth + 1)}
        </div>
      );
    });
  }

  const filteredTree: TreeEntry[] = search.trim()
    ? list
        .filter(
          (item) =>
            item.path.toLowerCase().includes(search.toLowerCase()) ||
            item.name.toLowerCase().includes(search.toLowerCase())
        )
        .map((item) => ({ type: "file" as const, path: item.path, name: item.name }))
    : tree;

  const hasProject = list.length > 0 && (sourceKind === "github" || sourceKind === "local");

  return (
    <main className="main-content">
      <h1 style={{ marginBottom: 8, fontSize: 24, fontWeight: 600, color: "var(--text)" }}>
        UI Component Test Generator
      </h1>
      <p style={{ color: "var(--text-muted)", marginBottom: 24, fontSize: 14 }}>
        Add a GitHub repository URL or upload a local project folder. We detect React/Next.js components (.tsx, .jsx, .ts, .js), then generate Jest + React Testing Library tests.
      </p>

      <section style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 10, color: "var(--text)" }}>
            A. GitHub Repository
          </h2>
          <form onSubmit={handleScan}>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
              <input
                type="url"
                value={repoUrl}
                onChange={(e) => setRepoUrl(e.target.value)}
                placeholder="https://github.com/owner/repo or .../owner/repo/tree/branch"
                disabled={scanning}
                style={{
                  flex: "1",
                  minWidth: 280,
                  padding: "10px 14px",
                  fontSize: 14,
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  backgroundColor: "var(--bg-elevated)",
                  color: "var(--text)",
                }}
              />
              <button
                type="submit"
                disabled={scanning}
                style={{
                  padding: "10px 20px",
                  fontSize: 14,
                  fontWeight: 600,
                  backgroundColor: scanning ? "var(--accent-disabled)" : "var(--accent)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  cursor: scanning ? "not-allowed" : "pointer",
                }}
              >
                {scanning ? "Scanning…" : "Scan repository"}
              </button>
            </div>
          </form>
        </div>

        <div>
          <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 10, color: "var(--text)" }}>
            B. Local Project Upload
          </h2>
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            style={{
              border: "2px dashed var(--border)",
              borderRadius: 12,
              padding: 24,
              textAlign: "center",
              backgroundColor: "var(--bg-elevated)",
              cursor: "pointer",
            }}
            onClick={() => document.getElementById("local-upload-input")?.click()}
          >
            <input
              id="local-upload-input"
              type="file"
              multiple
              {...({ webkitdirectory: "" } as React.InputHTMLAttributes<HTMLInputElement>)}
              style={{ display: "none" }}
              onChange={(e) => handleUpload(e.target.files)}
            />
            {uploading ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 10 }}>
                <p style={{ margin: 0, color: "var(--text)", fontSize: 14 }}>
                  Reading files… {uploadProgress != null ? `${uploadProgress}%` : ""}
                </p>
                {uploadProgress != null && (
                  <div
                    style={{
                      width: "100%",
                      maxWidth: 280,
                      height: 8,
                      backgroundColor: "var(--border)",
                      borderRadius: 4,
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${uploadProgress}%`,
                        height: "100%",
                        backgroundColor: "var(--accent)",
                        borderRadius: 4,
                        transition: "width 0.2s ease-out",
                      }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <>
                <p style={{ margin: "0 0 8px 0", color: "var(--text)", fontSize: 14 }}>
                  Drag & drop a folder here, or click to browse
                </p>
                <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 12 }}>
                  We use .js, .jsx, .ts, .tsx and skip node_modules, build, and test files.
                </p>
              </>
            )}
          </div>
          <p style={{ margin: "8px 0 0", fontSize: 12, color: "var(--text-muted)" }}>
            For folder upload: use a browser that supports folder selection (Chrome, Edge). For multiple files, select several files at once.
          </p>
        </div>
      </section>

      {scanning && (
        <div
          style={{
            marginTop: 16,
            padding: 16,
            backgroundColor: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: 8,
          }}
        >
          <p style={{ margin: "0 0 8px 0", fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
            Scanning repository
          </p>
          <ul style={{ margin: 0, paddingLeft: 20, listStyle: "none" }}>
            {SCAN_STEPS.map((label, i) => (
              <li
                key={label}
                style={{
                  position: "relative",
                  marginBottom: 4,
                  paddingLeft: 8,
                  fontSize: 13,
                  color: i <= scanStep ? "var(--text)" : "var(--text-muted)",
                  opacity: i <= scanStep ? 1 : 0.6,
                }}
              >
                <span style={{ position: "absolute", left: -20 }}>
                  {i < scanStep ? "✓" : i === scanStep ? "⋯" : "○"}
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {scanError && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            backgroundColor: "var(--error-bg)",
            border: "1px solid var(--error-border)",
            borderRadius: 8,
            color: "var(--error-text)",
            fontSize: 14,
          }}
        >
          {scanError}
        </div>
      )}

      {uploadError && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            backgroundColor: "var(--error-bg)",
            border: "1px solid var(--error-border)",
            borderRadius: 8,
            color: "var(--error-text)",
            fontSize: 14,
          }}
        >
          {uploadError}
        </div>
      )}

      {!scanning && list.length === 0 && repo && (
        <div
          style={{
            marginTop: 24,
            padding: 24,
            textAlign: "center",
            backgroundColor: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: 8,
            color: "var(--text-muted)",
            fontSize: 14,
          }}
        >
          No UI components found in this repository. We look for .js, .jsx, .ts, .tsx and skip node_modules, build, and test files.
        </div>
      )}

      {hasProject && (
        <section style={{ marginTop: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 12 }}>
            <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: "var(--text)" }}>
              Project structure — {list.length} component{list.length !== 1 ? "s" : ""}
              {selectedPaths.length > 0 && ` · ${selectedPaths.length} selected`}
            </h2>
            <button
              type="button"
              onClick={selectAllComponents}
              style={{
                padding: "6px 14px",
                fontSize: 13,
                fontWeight: 500,
                backgroundColor: "var(--bg-elevated)",
                color: "var(--text)",
                border: "1px solid var(--border)",
                borderRadius: 6,
                cursor: "pointer",
              }}
            >
              Select All Components
            </button>
          </div>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or path…"
            style={{
              width: "100%",
              marginBottom: 12,
              padding: "8px 12px",
              fontSize: 14,
              border: "1px solid var(--border)",
              borderRadius: 8,
              backgroundColor: "var(--bg-elevated)",
              color: "var(--text)",
            }}
          />
          <div
            style={{
              maxHeight: 320,
              overflow: "auto",
              border: "1px solid var(--border)",
              borderRadius: 8,
              backgroundColor: "var(--bg-elevated)",
            }}
          >
            {search.trim() ? (
              filteredList.map((item) => {
                const isSelected = selectedPath === item.path;
                const isChecked = isPathSelected(item.path);
                const hasGenerated = item.path in generatedTests;
                const isReact = isReactFile(item.path);
                return (
                  <div
                    key={item.path}
                    role="button"
                    tabIndex={0}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('input[type="checkbox"]')) return;
                      setSelectedPath(item.path);
                    }}
                    onKeyDown={(e) => e.key === "Enter" && setSelectedPath(item.path)}
                    style={{
                      padding: "8px 12px",
                      cursor: "pointer",
                      borderBottom: "1px solid var(--border)",
                      backgroundColor: isSelected ? "var(--accent)" : "transparent",
                      color: isSelected ? "#fff" : "var(--text)",
                      fontSize: 13,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={(e) => {
                        e.stopPropagation();
                        togglePathSelection(item.path);
                      }}
                      onClick={(e) => e.stopPropagation()}
                      aria-label={`Select ${item.name}`}
                    />
                    {hasGenerated && (
                      <span style={{ fontSize: 12, opacity: 0.9 }} title="Test generated">✓</span>
                    )}
                    <strong style={isReact ? { color: "var(--accent)" } : undefined}>{item.name}</strong>
                    <span style={{ opacity: 0.9 }}>{item.path}</span>
                  </div>
                );
              })
            ) : (
              renderTree(filteredTree as TreeEntry[], 0)
            )}
          </div>

          {selectedPath && (
            <div style={{ marginTop: 16 }}>
              <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 14, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={previewOpen}
                  onChange={(e) => setPreviewOpen(e.target.checked)}
                />
                Preview source code
              </label>
              {previewOpen && (
                <div
                  style={{
                    marginTop: 8,
                    padding: 12,
                    backgroundColor: "var(--code-bg)",
                    borderRadius: 8,
                    maxHeight: 240,
                    overflow: "auto",
                  }}
                >
                  {sourceLoading ? (
                    <p style={{ margin: 0, color: "var(--text-muted)", fontSize: 13 }}>Loading…</p>
                  ) : (
                    <pre
                      style={{
                        margin: 0,
                        fontSize: 12,
                        lineHeight: 1.5,
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        color: "var(--code-text)",
                      }}
                    >
                      {sourceContent ?? "—"}
                    </pre>
                  )}
                </div>
              )}
              <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={handleGenerate}
                  disabled={generating || generatingAll || sourceLoading}
                  style={{
                    padding: "10px 20px",
                    fontSize: 14,
                    fontWeight: 600,
                    backgroundColor: (generating || generatingAll) ? "var(--accent-disabled)" : "var(--accent)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    cursor: (generating || generatingAll) ? "not-allowed" : "pointer",
                  }}
                >
                  {generating ? "Generating…" : "Generate tests"}
                </button>
                {selectedPaths.length > 0 && (
                  <button
                    type="button"
                    onClick={handleGenerateSelected}
                    disabled={generating || generatingAll}
                    style={{
                      padding: "10px 20px",
                      fontSize: 14,
                      fontWeight: 600,
                      backgroundColor: (generating || generatingAll) ? "var(--accent-disabled)" : "var(--accent)",
                      color: "#fff",
                      border: "none",
                      borderRadius: 8,
                      cursor: (generating || generatingAll) ? "not-allowed" : "pointer",
                    }}
                  >
                    {generating ? "Generating…" : `Generate for ${selectedPaths.length} selected`}
                  </button>
                )}
              </div>
            </div>
          )}
          {list.length > 0 && (
            <div style={{ display: "flex", gap: 12, marginTop: 12, flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="button"
                onClick={handleGenerateAll}
                disabled={generating || generatingAll || list.length === 0}
                style={{
                  padding: "10px 20px",
                  fontSize: 14,
                  fontWeight: 500,
                  backgroundColor: (generating || generatingAll) ? "var(--bg-elevated)" : "var(--bg-elevated)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  cursor: (generating || generatingAll) ? "not-allowed" : "pointer",
                }}
              >
                {generatingAll ? "Generating all…" : "Generate all"}
              </button>
              {Object.keys(generatedTests).length > 0 && (
                <button
                  type="button"
                  onClick={handleDownloadTests}
                  disabled={downloadZipFeedback}
                  style={{
                    padding: "10px 20px",
                    fontSize: 14,
                    fontWeight: 600,
                    backgroundColor: "var(--accent)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 8,
                    cursor: downloadZipFeedback ? "not-allowed" : "pointer",
                  }}
                >
                  {downloadZipFeedback ? "Downloaded" : `Download Tests (${Object.keys(generatedTests).length})`}
                </button>
              )}
            </div>
          )}
        </section>
      )}

      {generating && (
        <div
          style={{
            marginTop: 24,
            padding: 16,
            backgroundColor: "var(--bg-elevated)",
            border: "1px solid var(--border)",
            borderRadius: 8,
          }}
        >
          <p style={{ margin: "0 0 8px 0", fontSize: 14, fontWeight: 600, color: "var(--text)" }}>
            Generating test cases
          </p>
          <ul style={{ margin: 0, paddingLeft: 20, listStyle: "none" }}>
            {GENERATE_STEPS.map((label, i) => (
              <li
                key={label}
                style={{
                  position: "relative",
                  marginBottom: 4,
                  paddingLeft: 8,
                  fontSize: 13,
                  color: i <= genStep ? "var(--text)" : "var(--text-muted)",
                  opacity: i <= genStep ? 1 : 0.6,
                }}
              >
                <span style={{ position: "absolute", left: -20 }}>
                  {i < genStep ? "✓" : i === genStep ? "⋯" : "○"}
                </span>
                {label}
              </li>
            ))}
          </ul>
        </div>
      )}

      {genError && (
        <div
          style={{
            marginTop: 16,
            padding: 12,
            backgroundColor: "var(--error-bg)",
            border: "1px solid var(--error-border)",
            borderRadius: 8,
            color: "var(--error-text)",
            fontSize: 14,
          }}
        >
          {genError}
        </div>
      )}

      {tests && (
        <section style={{ marginTop: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              <h2 style={{ fontSize: 18, fontWeight: 600, margin: 0, color: "var(--text)" }}>
                Generated test cases
              </h2>
              {providerUsed && (
                <span style={{ fontSize: 12, color: "var(--text-muted)" }} title="AI provider used for this request">
                  (via {providerUsed})
                </span>
              )}
            </div>
            {Object.keys(generatedTests).length > 1 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, alignItems: "center" }}>
                <span style={{ fontSize: 12, color: "var(--text-muted)" }}>View:</span>
                {Object.keys(generatedTests).map((path) => {
                  const name = path.split("/").pop()?.replace(/\.(jsx?|tsx?)$/i, "") ?? path;
                  const isActive = selectedPath === path;
                  return (
                    <button
                      key={path}
                      type="button"
                      onClick={() => {
                        setSelectedPath(path);
                        setTests(generatedTests[path]);
                      }}
                      style={{
                        padding: "4px 10px",
                        fontSize: 12,
                        fontWeight: isActive ? 600 : 500,
                        backgroundColor: isActive ? "var(--accent)" : "var(--bg-elevated)",
                        color: isActive ? "#fff" : "var(--text)",
                        border: isActive ? "none" : "1px solid var(--border)",
                        borderRadius: 6,
                        cursor: "pointer",
                      }}
                    >
                      {name}
                    </button>
                  );
                })}
              </div>
            )}
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={handleCopy}
                style={{
                  padding: "6px 14px",
                  fontSize: 13,
                  fontWeight: 500,
                  backgroundColor: "var(--bg-elevated)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                {copyFeedback ? "Copied" : "Copy"}
              </button>
              <button
                type="button"
                onClick={handleDownload}
                style={{
                  padding: "6px 14px",
                  fontSize: 13,
                  fontWeight: 500,
                  backgroundColor: "var(--bg-elevated)",
                  color: "var(--text)",
                  border: "1px solid var(--border)",
                  borderRadius: 6,
                  cursor: "pointer",
                }}
              >
                {downloadFeedback ? "Downloaded" : "Download"}
              </button>
              {Object.keys(generatedTests).length > 0 && (
                <button
                  type="button"
                  onClick={handleDownloadTests}
                  disabled={downloadZipFeedback}
                  style={{
                    padding: "6px 14px",
                    fontSize: 13,
                    fontWeight: 500,
                    backgroundColor: "var(--accent)",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    cursor: downloadZipFeedback ? "not-allowed" : "pointer",
                  }}
                >
                  {downloadZipFeedback ? "Downloaded" : "Download Tests (ZIP)"}
                </button>
              )}
              <button
                type="button"
                onClick={handleGenerate}
                disabled={generating}
                style={{
                  padding: "6px 14px",
                  fontSize: 13,
                  fontWeight: 500,
                  backgroundColor: "var(--accent)",
                  color: "#fff",
                  border: "none",
                  borderRadius: 6,
                  cursor: generating ? "not-allowed" : "pointer",
                }}
              >
                Regenerate
              </button>
            </div>
          </div>
          <pre
            style={{
              margin: 0,
              padding: 16,
              backgroundColor: "var(--code-bg)",
              color: "var(--code-text)",
              borderRadius: 8,
              overflow: "auto",
              fontSize: 13,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {tests}
          </pre>
        </section>
      )}

      {/* <p style={{ marginTop: 32, color: "var(--text-muted)", fontSize: 12 }}>
        Optional: set GITHUB_TOKEN in .env.local for higher API rate limits. Set BRAIN_API_KEY, CLAUDE_API_KEY, or GEMINI_API_KEY for test generation.
      </p> */}
    </main>
  );
}
