import { getProgramDeadlineBadgeData } from "@/lib/program-display";
import type { ProgramBaseSummary } from "@/lib/types";

type ProgramDeadlineBadgeProps = {
  program: Pick<ProgramBaseSummary, "days_left" | "deadline">;
  className?: string;
};

export function ProgramDeadlineBadge({
  program,
  className = "",
}: ProgramDeadlineBadgeProps) {
  const badge = getProgramDeadlineBadgeData(program);
  if (!badge) {
    return null;
  }

  const toneClassName =
    badge.tone === "critical"
      ? "border-rose-200 bg-rose-50 text-rose-700"
      : badge.tone === "warning"
        ? "border-amber-200 bg-amber-50 text-amber-700"
        : badge.tone === "closed"
          ? "border-slate-200 bg-slate-100 text-slate-500"
          : "border-yellow-200 bg-yellow-50 text-amber-700";

  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full border px-3 py-1 text-xs font-black tracking-[-0.01em] ${toneClassName} ${className}`.trim()}
    >
      {badge.label}
    </span>
  );
}
