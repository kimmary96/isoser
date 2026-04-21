import type { Program } from "@/lib/types";

export function normalizeTextList(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function formatDateLabel(value: string | null | undefined): string {
  if (!value) return "일정 추후 공지";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

export function getProgramDeadline(program: Program): string {
  if (typeof program.days_left === "number") {
    if (program.days_left < 0) return "마감";
    if (program.days_left === 0) return "D-Day";
    return `D-${program.days_left}`;
  }

  if (program.deadline) {
    return formatDateLabel(program.deadline);
  }

  return "일정 추후 공지";
}

export function getProgramDeadlineTone(program: Program): string {
  if (typeof program.days_left !== "number") return "text-[var(--green)]";
  if (program.days_left <= 3) return "text-[var(--red)]";
  if (program.days_left <= 7) return "text-[var(--fire)]";
  if (program.days_left <= 14) return "text-[var(--amber)]";
  return "text-[var(--green)]";
}

export function getProgramDetailHref(program: Program): string {
  return typeof program.id === "string" || typeof program.id === "number" ? `/programs/${program.id}` : "/programs";
}

export function getProgramCompareHref(program: Program): string {
  return typeof program.id === "string" || typeof program.id === "number"
    ? `/compare?ids=${encodeURIComponent(String(program.id))}`
    : "/compare";
}

export function getProgramScore(program: Program): number {
  const rawScore = program.relevance_score ?? program.final_score ?? program._score ?? 0;
  return rawScore > 1 ? Math.round(rawScore) : Math.round(rawScore * 100);
}
