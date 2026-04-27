import {
  formatProgramDeadlineCountdown,
  getProgramDeadlineTone,
  isDisplayableProgramSummary,
  normalizeProgramTextList,
} from "@/lib/program-display";
import { getProgramCardScore, toProgramCardItem } from "@/lib/program-card-items";
import type { ProgramListRow, ProgramSurfaceContext } from "@/lib/types";

export function isDisplayableProgram(program: ProgramListRow): boolean {
  return isDisplayableProgramSummary(program);
}

export function normalizeTextList(value: string[] | string | null | undefined): string[] {
  return normalizeProgramTextList(value);
}

export function scorePercent(
  program: ProgramListRow,
  context?: ProgramSurfaceContext | null
): number | null {
  const score = getProgramCardScore(toProgramCardItem(program, context ?? null));
  if (typeof score !== "number" || Number.isNaN(score)) return null;
  return Math.max(0, Math.min(100, Math.round(score <= 1 ? score * 100 : score)));
}

export function deadlineLabel(program: ProgramListRow): string | null {
  if (typeof program.days_left === "number") {
    return formatProgramDeadlineCountdown(program.days_left);
  }
  if (!program.deadline) return null;
  const date = new Date(program.deadline);
  if (Number.isNaN(date.getTime())) return program.deadline;
  return date.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

export function deadlineTone(program: ProgramListRow): string {
  return getProgramDeadlineTone(program.days_left);
}
