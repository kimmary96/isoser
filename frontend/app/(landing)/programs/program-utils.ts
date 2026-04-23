import type { Program } from "@/lib/types";

export function isDisplayableProgram(program: Program): boolean {
  return Boolean(program.title?.trim() && program.source?.trim());
}

export function normalizeTextList(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string" && item.trim());
  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }
  return [];
}

export function scorePercent(program: Program): number | null {
  const score = program._relevance_score ?? program.relevance_score ?? program._score ?? program.final_score;
  if (typeof score !== "number" || Number.isNaN(score)) return null;
  return Math.max(0, Math.min(100, Math.round(score <= 1 ? score * 100 : score)));
}

export function deadlineLabel(program: Program): string | null {
  if (typeof program.days_left === "number") {
    if (program.days_left < 0) return "마감";
    if (program.days_left === 0) return "D-Day";
    return `D-${program.days_left}`;
  }
  if (!program.deadline) return null;
  const date = new Date(program.deadline);
  if (Number.isNaN(date.getTime())) return program.deadline;
  return date.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

export function deadlineTone(program: Program): string {
  if (typeof program.days_left !== "number") return "bg-slate-100 text-slate-600";
  if (program.days_left <= 3) return "bg-rose-100 text-rose-700";
  if (program.days_left <= 7) return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
}
