import type { CSSProperties } from "react";

export const landingBThemeVars = {
  "--ink": "#0F172A",
  "--blue": "#2563EB",
  "--blue-lo": "#1D4ED8",
  "--blue-bg": "#EFF6FF",
  "--sky": "#60A5FA",
  "--fire": "#F97316",
  "--fire-lo": "#EA580C",
  "--fire-bg": "#FFF7ED",
  "--green": "#16A34A",
  "--red": "#DC2626",
  "--amber": "#D97706",
  "--surface": "#F8FAFC",
  "--border": "#E2E8F0",
  "--muted": "#94A3B8",
  "--sub": "#64748B",
} as CSSProperties;

export const landingBStyles = `
  .landing-hero::before {
    content: "";
    position: absolute;
    inset: 0;
    pointer-events: none;
    background-image: radial-gradient(circle, #cbd5e1 1px, transparent 1px);
    background-size: 28px 28px;
    opacity: 0.5;
    mask-image: radial-gradient(ellipse 90% 90% at 50% 50%, black 30%, transparent 80%);
  }

  .landing-blob {
    position: absolute;
    pointer-events: none;
    border-radius: 9999px;
    filter: blur(80px);
    opacity: 0.12;
  }

  .landing-blob-primary {
    width: 500px;
    height: 400px;
    background: var(--blue);
    top: -100px;
    left: 50%;
    transform: translateX(-50%);
  }

  .landing-blob-secondary {
    width: 300px;
    height: 300px;
    background: var(--fire);
    bottom: -60px;
    right: 5%;
  }

  .fade-up {
    animation: fadeUp 0.5s ease both;
  }

  .delay-1 {
    animation-delay: 0.08s;
  }

  .delay-2 {
    animation-delay: 0.14s;
  }

  .delay-3 {
    animation-delay: 0.2s;
  }

  @keyframes fadeUp {
    from {
      opacity: 0;
      transform: translateY(14px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`;
