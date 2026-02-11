"use client";

import { useMemo } from "react";

const FLAKE_COUNT = 250;
const FADE_DURATION_MS = 1400;

/**
 * Full-viewport falling snow overlay. Visibility is controlled by `active`;
 * opacity transitions for a slow fade-in when turning on and fade-out when turning off.
 */
export function Snow({ active }: { active: boolean }) {
  const flakes = useMemo(
    () =>
      Array.from({ length: FLAKE_COUNT }, (_, i) => ({
        id: i,
        left: Math.random() * 100,
        size: 2 + Math.random() * 0.3,
        duration: 8 + Math.random() * 8,
        delay: Math.random() * -20,
        opacity: 0.4 + Math.random() * 0.6,
      })),
    []
  );

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        inset: 0,
        pointerEvents: "none",
        zIndex: 9999,
        overflow: "hidden",
        opacity: active ? 1 : 0,
        transition: `opacity ${FADE_DURATION_MS}ms ease-in-out`,
      }}
    >
      {flakes.map((f) => (
        <div
          key={f.id}
          className="snowflake"
          style={{
            position: "absolute",
            left: `${f.left}%`,
            top: "-20px",
            width: f.size,
            height: f.size,
            borderRadius: "50%",
            backgroundColor: "rgba(255, 255, 255, 0.9)",
            boxShadow: "0 0 6px rgba(255,255,255,0.8)",
            opacity: f.opacity,
            animation: `snowfall ${f.duration}s linear ${f.delay}s infinite`,
          }}
        />
      ))}
    </div>
  );
}
