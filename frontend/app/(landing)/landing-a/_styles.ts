import type { CSSProperties } from "react";

export const landingAThemeVars = {
  "--ink": "#0A1325",
  "--ink-mid": "#14233F",
  "--ink-soft": "#1C335D",
  "--blue": "#2B6FF2",
  "--blue-lo": "#1F5AD1",
  "--sky": "#8FC2FF",
  "--fire": "#F97316",
  "--fire-lo": "#EA580C",
  "--red": "#EF4444",
  "--amber": "#F59E0B",
  "--green": "#22C55E",
  "--surface": "#F4F7FB",
  "--surface-strong": "#E8EEF8",
  "--white": "#FFFFFF",
  "--border": "#D8E3F2",
  "--muted": "#9DB0CC",
  "--sub": "#5B6E8A",
} as CSSProperties;

export const landingAStyles = `
  .ticker-track {
    animation: ticker 28s linear infinite;
  }

  .landing-hero::before {
    content: "";
    position: absolute;
    inset: 0;
    background:
      radial-gradient(circle at 18% 18%, rgba(43, 111, 242, 0.16), transparent 34%),
      radial-gradient(circle at 82% 22%, rgba(249, 115, 22, 0.12), transparent 28%),
      linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(244, 247, 251, 0.94));
    pointer-events: none;
  }

  .landing-hero::after {
    content: "";
    position: absolute;
    inset: auto -10% -18% 44%;
    height: 360px;
    border-radius: 999px;
    background: radial-gradient(circle, rgba(143, 194, 255, 0.2), transparent 68%);
    filter: blur(4px);
    pointer-events: none;
  }

  .hero-grid {
    background-image:
      linear-gradient(rgba(157, 176, 204, 0.08) 1px, transparent 1px),
      linear-gradient(90deg, rgba(157, 176, 204, 0.08) 1px, transparent 1px);
    background-size: 32px 32px;
  }

  .hero-wordmark {
    background: linear-gradient(90deg, #0a1325, #2b6ff2 55%, #f97316 100%);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
  }

  .section-shell {
    position: relative;
  }

  .section-shell::before {
    content: "";
    position: absolute;
    inset: 0;
    border-radius: 32px;
    border: 1px solid rgba(216, 227, 242, 0.85);
    pointer-events: none;
  }

  .trust-divider {
    background: linear-gradient(90deg, rgba(43, 111, 242, 0.28), rgba(249, 115, 22, 0.12));
  }

  .soft-panel {
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(244, 247, 251, 0.94));
    box-shadow: 0 28px 80px rgba(10, 19, 37, 0.08);
  }

  .glass-panel {
    background: linear-gradient(180deg, rgba(255, 255, 255, 0.96), rgba(244, 247, 251, 0.96));
    box-shadow: 0 28px 80px rgba(10, 19, 37, 0.08);
  }

  .program-shell {
    background:
      radial-gradient(circle at top right, rgba(43, 111, 242, 0.05), transparent 30%),
      linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(244, 247, 251, 0.96));
  }

  .compare-shell {
    background:
      radial-gradient(circle at top left, rgba(143, 194, 255, 0.2), transparent 28%),
      linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(236, 244, 255, 0.96));
    border: 1px solid rgba(216, 227, 242, 0.95);
    box-shadow: 0 22px 60px rgba(10, 19, 37, 0.08);
  }

  .journey-line::before {
    content: "";
    position: absolute;
    left: 22px;
    top: 52px;
    bottom: -28px;
    width: 1px;
    background: linear-gradient(180deg, rgba(43, 111, 242, 0.34), rgba(216, 227, 242, 0.2));
  }

  .no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }

  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }

  @media (max-width: 1023px) {
    .journey-line::before {
      display: none;
    }
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
