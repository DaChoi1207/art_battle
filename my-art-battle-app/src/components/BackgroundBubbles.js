// src/components/BackgroundBubbles.js
import React from "react";

/**
 * SVG overlay with animated, subtle white/pastel bubbles and lines.
 * Place this at the top of your App, behind your main content, with absolute/fixed positioning.
 */
export default function BackgroundBubbles() {
  return (
    <svg
      className="background-bubbles"
      width="100vw"
      height="100vh"
      viewBox="0 0 1920 1080"
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        width: "100vw",
        height: "100vh",
        zIndex: 0,
        pointerEvents: "none",
        opacity: 0.6,
        mixBlendMode: "lighten",
      }}
    >
      {/* Large, subtle bubbles */}
      <circle cx="400" cy="300" r="120" stroke="#fff" strokeWidth="4" fill="none" opacity="0.08">
        <animate attributeName="cy" values="300;350;300" dur="12s" repeatCount="indefinite" />
      </circle>
      <circle cx="1600" cy="200" r="80" stroke="#fff" strokeWidth="3" fill="none" opacity="0.06">
        <animate attributeName="cx" values="1600;1620;1600" dur="16s" repeatCount="indefinite" />
      </circle>
      <circle cx="1000" cy="800" r="180" stroke="#fff" strokeWidth="2.5" fill="none" opacity="0.07">
        <animate attributeName="r" values="180;200;180" dur="18s" repeatCount="indefinite" />
      </circle>
      <circle cx="300" cy="900" r="60" stroke="#fff" strokeWidth="2" fill="none" opacity="0.09">
        <animate attributeName="cy" values="900;870;900" dur="14s" repeatCount="indefinite" />
      </circle>
      {/* Optional: a pastel bubble */}
      <circle cx="1450" cy="950" r="100" stroke="#a685e2" strokeWidth="2" fill="none" opacity="0.05">
        <animate attributeName="r" values="100;120;100" dur="20s" repeatCount="indefinite" />
      </circle>
      {/* Wavy line */}
      <path d="M 200 700 Q 400 650 600 700 T 1000 700 T 1400 750 T 1800 700" stroke="#fff" strokeWidth="2" fill="none" opacity="0.04">
        <animate attributeName="d" values="M 200 700 Q 400 650 600 700 T 1000 700 T 1400 750 T 1800 700;M 200 710 Q 400 670 600 690 T 1000 710 T 1400 770 T 1800 700;M 200 700 Q 400 650 600 700 T 1000 700 T 1400 750 T 1800 700" dur="22s" repeatCount="indefinite" />
      </path>
    </svg>
  );
}
