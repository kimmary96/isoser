import {
  formatProgramCostLabel,
  getProgramSelectionKeywords,
  getProgramSupportBadge,
} from "@/lib/program-display";
import type { ProgramListRow } from "@/lib/types";

import { deadlineLabel, normalizeTextList } from "./program-utils";

export function formatShortDate(value?: string | null): string {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ko-KR", { year: "2-digit", month: "2-digit", day: "2-digit" });
}

export function formatDateRange(start?: string | null, end?: string | null): string {
  const startText = formatShortDate(start);
  const endText = formatShortDate(end);
  if (startText === "-" && endText === "-") return "-";
  if (startText === "-") return endText;
  if (endText === "-") return startText;
  if (startText === endText) return startText;
  return `${startText} ~ ${endText}`;
}

export function formatCost(program: ProgramListRow): string {
  return formatProgramCostLabel(program) || "-";
}

export function getSupportBadge(program: ProgramListRow): string | null {
  return getProgramSupportBadge(program);
}

export function formatMethodAndRegion(program: ProgramListRow): { method: string | null; region: string | null } {
  return {
    method: program.teaching_method?.trim() || null,
    region: program.location?.trim() || null,
  };
}

export function formatRecruitingStatus(program: ProgramListRow): string {
  const label = deadlineLabel(program);
  if (!label) return "마감일 미확인";
  if (typeof program.days_left === "number" && program.days_left < 0) return "마감";
  return label;
}

export function getDisplayCategories(program: ProgramListRow): string[] {
  const derived = normalizeTextList(program.display_categories);
  if (derived.length) return derived.slice(0, 2);
  return [program.category, program.category_detail].filter((value): value is string => Boolean(value?.trim())).slice(0, 2);
}

export function extractSelectionKeywords(program: ProgramListRow): string[] {
  return getProgramSelectionKeywords(program);
}
