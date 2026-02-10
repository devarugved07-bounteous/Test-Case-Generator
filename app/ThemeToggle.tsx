"use client";

import { useTheme } from "./ThemeProvider";

export function ThemeToggle() {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={toggleTheme}
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
      style={{
        position: "fixed",
        top: 16,
        right: 16,
        zIndex: 50,
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "8px 12px",
        borderRadius: 9999,
        border: "1px solid var(--border)",
        background: "var(--bg-elevated)",
        color: "var(--text)",
        cursor: "pointer",
        fontSize: 14,
        boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
      }}
    >
      <span style={{ width: 20, height: 20 }} aria-hidden>
        {isDark ? "☀️" : "🌙"}
      </span>
      <span
        style={{
          width: 40,
          height: 22,
          borderRadius: 11,
          background: isDark ? "var(--toggle-track)" : "var(--accent)",
          position: "relative",
          flexShrink: 0,
        }}
      >
        <span
          style={{
            position: "absolute",
            top: 2,
            left: isDark ? 2 : 20,
            width: 18,
            height: 18,
            borderRadius: "50%",
            background: "var(--toggle-thumb)",
            transition: "left 0.2s ease",
            boxShadow: "0 1px 3px rgba(0,0,0,0.3)",
          }}
        />
      </span>
    </button>
  );
}
