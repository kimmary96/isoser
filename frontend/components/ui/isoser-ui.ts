import type { CSSProperties } from "react";

export function cx(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

export const isoserThemeVars = {
  "--iso-ink": "#0A1325",
  "--iso-sub": "#5B6E8A",
  "--iso-muted": "#8EA2BF",
  "--iso-dark": "#071A36",
  "--iso-primary": "#094CB2",
  "--iso-primary-hover": "#073C8F",
  "--iso-primary-soft": "#E8F0FE",
  "--iso-accent": "#E0621A",
  "--iso-accent-hover": "#C94F12",
  "--iso-accent-soft": "#FFF3E8",
  "--iso-surface": "#F3F6FB",
  "--iso-surface-strong": "#F8FAFC",
  "--iso-border": "#E2E8F0",
} as CSSProperties;

export const iso = {
  page: "min-h-screen bg-[#f3f6fb] text-slate-950",
  pageSoft: "min-h-screen bg-[linear-gradient(180deg,#f8fafc,#f3f6fb)] text-slate-950",
  headerBand:
    "border-b border-slate-200 bg-[linear-gradient(135deg,#f8fafc_0%,#eef3f8_58%,#fff7ed_100%)]",
  glassPanel:
    "border border-white/80 bg-white/90 shadow-[0_28px_72px_rgba(15,23,42,0.10)] backdrop-blur-xl",
  softPanel:
    "border border-slate-200 bg-white shadow-[0_14px_36px_rgba(15,23,42,0.06)]",
  whitePanel: "border border-slate-200 bg-white shadow-sm",
  card: "rounded-[24px] border border-slate-200 bg-white shadow-sm",
  cardSoft: "rounded-[24px] border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)]",
  primaryButton:
    "bg-[linear-gradient(135deg,#094cb2,#3b82f6)] text-white shadow-[0_12px_28px_rgba(9,76,178,0.18)] transition hover:brightness-95",
  accentButton:
    "bg-[#e0621a] text-white shadow-[0_12px_26px_rgba(224,98,26,0.20)] transition hover:bg-[#c94f12]",
  accentSoft: "border border-orange-200 bg-orange-50 text-orange-700",
  darkButton: "bg-[#071a36] text-white transition hover:bg-[#0a2146]",
  secondaryButton:
    "border border-slate-200 bg-white text-slate-700 transition hover:border-orange-200 hover:text-orange-700",
  darkBand: "bg-[#071a36] text-white",
  focusRing: "focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2",
} as const;
