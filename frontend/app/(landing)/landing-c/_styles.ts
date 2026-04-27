import type { CSSProperties } from "react";

import { isoserThemeVars } from "@/components/ui/isoser-ui";

export const landingCThemeVars = {
  ...isoserThemeVars,
  "--ink": "var(--iso-ink)",
  "--sub": "var(--iso-sub)",
  "--muted": "var(--iso-muted)",
  "--indigo": "var(--iso-primary)",
  "--indigo-hi": "var(--iso-primary-hover)",
  "--teal": "var(--iso-accent)",
  "--blue": "var(--iso-primary)",
  "--sky": "#60A5FA",
  "--fire": "var(--iso-accent)",
  "--fire-lo": "var(--iso-accent-hover)",
  "--surface": "var(--iso-surface)",
  "--surface-strong": "var(--iso-surface-strong)",
  "--border": "var(--iso-border)",
  "--red": "#EF4444",
  "--amber": "#F59E0B",
  "--green": "#22C55E",
} as CSSProperties;
