import type { CSSProperties } from "react";

export const landingAThemeVars = {
  "--ink": "#0A0F1E",
  "--ink-mid": "#151E38",
  "--ink-soft": "#1F2E52",
  "--blue": "#2563EB",
  "--blue-lo": "#1D4ED8",
  "--sky": "#60A5FA",
  "--fire": "#F97316",
  "--fire-lo": "#EA580C",
  "--red": "#EF4444",
  "--amber": "#F59E0B",
  "--green": "#22C55E",
  "--surface": "#F1F5F9",
  "--white": "#FFFFFF",
  "--border": "#E2E8F0",
  "--muted": "#94A3B8",
  "--sub": "#64748B",
} as CSSProperties;

export const landingAStyles = `
  .ticker-track {
    animation: ticker 28s linear infinite;
  }

  .hero-glow::before {
    content: "";
    position: absolute;
    top: -120px;
    left: 50%;
    width: 760px;
    height: 420px;
    transform: translateX(-50%);
    background: radial-gradient(ellipse, rgba(37, 99, 235, 0.22) 0%, transparent 66%);
    pointer-events: none;
  }

  .hero-glow::after {
    content: "";
    position: absolute;
    right: 10%;
    bottom: -80px;
    width: 320px;
    height: 320px;
    background: radial-gradient(circle, rgba(249, 115, 22, 0.16) 0%, transparent 62%);
    pointer-events: none;
  }

  .hero-gradient-blue {
    background: linear-gradient(90deg, #60a5fa, #818cf8);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .hero-gradient-fire {
    background: linear-gradient(90deg, #fb923c, #fbbf24);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }

  @keyframes ticker {
    from {
      transform: translateX(0);
    }
    to {
      transform: translateX(-50%);
    }
  }
`;
