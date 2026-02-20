"use client";

import { useState, useEffect, useCallback } from "react";
import type { RepoInfo, TreeEntry, ComponentItem, ScanResult } from "@/lib/types";

const SCAN_STEPS = ["Validating URL…", "Fetching repository…", "Scanning for components…"];
const GENERATE_STEPS = ["Analyzing component…", "Calling AI…", "Formatting tests…"];
const STEP_INTERVAL_MS = 1500;

type GenerateResult = {
  success: true;
  tests: string;
  implementation?: string;
  metadata?: { provider: string };
};

export default function Home() {
  const [repoUrl, setRepoUrl] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanStep, setScanStep] = useState(0);
  const [scanError, setScanError] = useState<string | null>(null);
  const [repo, setRepo] = useState<RepoInfo | null>(null);
  const [tree, setTree] = useState<TreeEntry[]>([]);
  const [list, setList] = useState<ComponentItem[]>([]);
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
  const FEEDBACK_RESET_MS = 2000;

  function togglePathSelection(path: string) {
    setSelectedPaths((prev) =>
      prev.includes(path) ? prev.filter((p) => p !== path) : [...prev, path]
    );
  }

  function isPathSelected(path: string) {
    return selectedPaths.includes(path);
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

  const filteredList = search.trim()
    ? list.filter(
        (item) =>
          item.path.toLowerCase().includes(search.toLowerCase()) ||
          item.name.toLowerCase().includes(search.toLowerCase())
      )
    : list;

  async function handleScan(e: React.FormEvent) {
    e.preventDefault();
    setScanError(null);
    setRepo(null);
    setTree([]);
    setList([]);
    setSelectedPath(null);
    setSelectedPaths([]);
    setSourceContent(null);
    setTests(null);
    setGenError(null);
    setProviderUsed(null);
    setCopyFeedback(false);
    setDownloadFeedback(false);
    setGeneratedTests({});
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
      setRepo(result.repo);
      setTree(result.tree);
      setList(result.list);
    } catch {
      setScanError("Network or server error. Try again.");
    } finally {
      setScanning(false);
    }
  }

  const loadSource = useCallback(async () => {
    if (!repo || !selectedPath) return;
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
  }, [repo, selectedPath]);

  useEffect(() => {
    if (previewOpen && selectedPath && repo) loadSource();
  }, [previewOpen, selectedPath, repo, loadSource]);

  async function handleGenerate() {
    if (!selectedPath || !repo) return;
    setGenError(null);
    setTests(null);
    setProviderUsed(null);
    setCopyFeedback(false);
    setDownloadFeedback(false);
    let content = sourceContent;
    if (content == null || content === "(Could not load file.)" || content === "(Failed to load file.)") {
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
    if (!content || !content.trim()) {
      setGenError("Could not load component source. Try again.");
      return;
    }
    setGenerating(true);
    try {
      const res = await fetch("/api/generate-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: content, mode: "component" }),
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
      if (testContent) {
        setGeneratedTests((prev) => ({ ...prev, [selectedPath]: testContent }));
      }
    } catch {
      setGenError("Network or server error. Try again.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleGenerateSelected() {
    if (!repo || selectedPaths.length === 0) return;
    setGenError(null);
    setGenerating(true);
    const paths = [...selectedPaths];
    let lastTests: string | null = null;
    let lastPath: string | null = null;
    try {
      for (const path of paths) {
        const params = new URLSearchParams({
          owner: repo.owner,
          repo: repo.repo,
          branch: repo.branch,
          path,
        });
        const fileRes = await fetch(`/api/repo/file?${params}`);
        const fileData = await fileRes.json();
        const content = fileRes.ok ? fileData.content : "";
        if (!content?.trim()) continue;
        const res = await fetch("/api/generate-tests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: content, mode: "component" }),
        });
        const data = await res.json();
        if (res.ok && data.success && data.tests) {
          setGeneratedTests((prev) => ({ ...prev, [path]: data.tests }));
          lastTests = data.tests;
          lastPath = path;
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
    if (!repo || list.length === 0) return;
    setGenError(null);
    setGeneratingAll(true);
    try {
      for (const item of list) {
        const params = new URLSearchParams({
          owner: repo.owner,
          repo: repo.repo,
          branch: repo.branch,
          path: item.path,
        });
        const fileRes = await fetch(`/api/repo/file?${params}`);
        const fileData = await fileRes.json();
        const content = fileRes.ok ? fileData.content : "";
        if (!content?.trim()) continue;
        const res = await fetch("/api/generate-tests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ input: content, mode: "component" }),
        });
        const data = await res.json();
        if (res.ok && data.success && data.tests) {
          setGeneratedTests((prev) => ({ ...prev, [item.path]: data.tests }));
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
    setDownloadZipFeedback(true);
    setGenError(null);
    try {
      const res = await fetch("/api/export-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: entries.map(([path, tests]) => ({ path, tests })),
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        const msg = (data as { error?: string }).error ?? "Download failed.";
        setGenError(msg);
        return;
      }
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
            {entry.name} <span style={{ opacity: 0.8, fontSize: 12 }}>{entry.path}</span>
          </div>
        );
      }
      const children = entry.children ?? [];
      return (
        <div key={entry.path}>
          <div
            style={{
              padding: "4px 12px",
              paddingLeft: 12 + depth * 16,
              fontSize: 13,
              fontWeight: 600,
              color: "var(--text-muted)",
            }}
          >
            {entry.name}/
          </div>
          {children.length > 0 && renderTree(children, depth + 1)}
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

  return (
    <main style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>
      <h1 style={{ marginBottom: 8, fontSize: 24, fontWeight: 600, color: "var(--text)" }}>
        UI Component Test Generator
      </h1>
      <p style={{ color: "var(--text-muted)", marginBottom: 24, fontSize: 14 }}>
        Paste a GitHub repository URL to scan for UI components (.js, .jsx, .ts, .tsx), select one, and generate Jest + React Testing Library tests.
      </p>

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

      {list.length > 0 && repo && (
        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 12, color: "var(--text)" }}>
            Components ({list.length})
          </h2>
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
                    <strong>{item.name}</strong> <span style={{ opacity: 0.9 }}>{item.path}</span>
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
        Optional: set GITHUB_TOKEN in .env.local for higher API rate limits. Set GEMINI_API_KEY for test generation.
      </p> */}
    </main>
  );
}
