"use client";

import { useState } from "react";

type Result = {
  success: true;
  isCode: boolean;
  tests: string;
  implementation?: string;
};

export default function Home() {
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tests, setTests] = useState<string | null>(null);
  const [implementation, setImplementation] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setTests(null);
    setImplementation(null);
    if (!input.trim()) {
      setError("Please enter code or a requirement.");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/generate-tests", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: input.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Request failed.");
        return;
      }
      const result = data as Result;
      setTests(result.tests ?? null);
      setImplementation(result.implementation ?? null);
    } catch {
      setError("Network or server error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main style={{ maxWidth: 900, margin: "0 auto", padding: 24 }}>
      <h1 style={{ marginBottom: 8, fontSize: 24, fontWeight: 600 }}>
        NextJS Test Case Generator
      </h1>
      <p style={{ color: "#888", marginBottom: 24, fontSize: 14 }}>
        Paste code or a plain English requirement. We&apos;ll generate Jest + React Testing Library tests via Gemini.
      </p>

      <form onSubmit={handleSubmit}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Paste your Next.js/JS/TS code here, or describe a requirement (e.g. generate test cases for a function that adds two numbers)"
          disabled={loading}
          style={{
            width: "100%",
            minHeight: 180,
            padding: 12,
            fontSize: 14,
            fontFamily: "ui-monospace, monospace",
            border: "1px solid #333",
            borderRadius: 8,
            resize: "vertical",
            boxSizing: "border-box",
            backgroundColor: "#111",
            color: "#fff",
          }}
        />
        <button
          type="submit"
          disabled={loading}
          style={{
            marginTop: 12,
            padding: "10px 20px",
            fontSize: 14,
            fontWeight: 600,
            backgroundColor: loading ? "#444" : "#0070f3",
            color: "#fff",
            border: "none",
            borderRadius: 8,
            cursor: loading ? "not-allowed" : "pointer",
          }}
        >
          {loading ? "Generating…" : "Generate Test Cases"}
        </button>
      </form>

      {error && (
        <div
          style={{
            marginTop: 24,
            padding: 12,
            backgroundColor: "rgba(255, 80, 80, 0.15)",
            border: "1px solid #f44",
            borderRadius: 8,
            color: "#f88",
            fontSize: 14,
          }}
        >
          {error}
        </div>
      )}

      {implementation && (
        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
            Implementation
          </h2>
          <pre
            style={{
              margin: 0,
              padding: 16,
              backgroundColor: "#1e1e1e",
              color: "#d4d4d4",
              borderRadius: 8,
              overflow: "auto",
              fontSize: 13,
              lineHeight: 1.5,
              whiteSpace: "pre-wrap",
              wordBreak: "break-word",
            }}
          >
            {implementation}
          </pre>
        </section>
      )}

      {tests && (
        <section style={{ marginTop: implementation ? 24 : 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 600, marginBottom: 8 }}>
            Generated Test Cases
          </h2>
          <pre
            style={{
              margin: 0,
              padding: 16,
              backgroundColor: "#1e1e1e",
              color: "#d4d4d4",
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
    </main>
  );
}
