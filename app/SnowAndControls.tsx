"use client";

import { useState } from "react";
import { Snow } from "./Snow";
import { ThemeToggle } from "./ThemeToggle";

/**
 * Layout wrapper that provides the snow overlay and top-right controls:
 * "Let it snow" toggle (turns snowfall on/off with fade animation) and theme toggle.
 */
const buttonStyle = {
  display: "flex",
  alignItems: "center",
  gap: 8,
  padding: "8px 12px",
  borderRadius: 9999,
  border: "1px solid var(--border)",
  background: "var(--bg-elevated)",
  color: "var(--text)",
  cursor: "pointer" as const,
  fontSize: 14,
  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
};

export function SnowAndControls({ children }: { children: React.ReactNode }) {
  const [snowOn, setSnowOn] = useState(false);

  return (
    <>
      <Snow active={snowOn} />
      <div
        style={{
          position: "fixed",
          top: 16,
          right: 16,
          zIndex: 50,
          display: "flex",
          alignItems: "center",
          gap: 8,
        }}
      >
        <button
          type="button"
          onClick={() => setSnowOn((s) => !s)}
          aria-label={snowOn ? "Turn off snowfall" : "Let it snow"}
          title={snowOn ? "Turn off snowfall" : "Let it snow"}
          style={{
            ...buttonStyle,
            ...(snowOn
              ? {
                  borderColor: "var(--accent)",
                  background: "var(--accent)",
                  color: "#fff",
                }
              : {}),
          }}
        >
          <span aria-hidden>❄️</span>
          <span>Let it snow</span>
        </button>
        <ThemeToggle />
      </div>
      {children}
    </>
  );
}
