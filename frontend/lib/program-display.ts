import type {
  CompareMeta,
  ProgramBaseSummary,
  ProgramCardRenderable,
  ProgramCardSummary,
  ProgramListRow,
  ProgramListRowItem,
  ProgramSelectSummary,
} from "@/lib/types";

type ProgramIdentity = Pick<ProgramBaseSummary, "id">;
type ProgramVisibility = Pick<ProgramBaseSummary, "title" | "source">;
type ProgramLinks = Pick<ProgramCardSummary, "application_url" | "link" | "source_url">;

type SourceLabelOptions = {
  work24TrainingLabel?: string;
  unknownLabel?: string;
};

export function getProgramId(program: ProgramIdentity | null | undefined): string {
  if (typeof program?.id === "string") {
    return program.id.trim();
  }

  if (typeof program?.id === "number") {
    return String(program.id);
  }

  return "";
}

export function isDisplayableProgramSummary(
  program: ProgramVisibility | null | undefined
): boolean {
  return Boolean(program?.title?.trim() && program?.source?.trim());
}

export function normalizeProgramTextList(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) {
    return value.filter((item) => typeof item === "string" && item.trim());
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

export function formatProgramMonthDay(value: string | null | undefined): string | null {
  if (!value) return null;

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${month}/${day}`;
}

export function formatProgramTrainingPeriod(
  startDate: string | null | undefined,
  endDate: string | null | undefined
): string {
  const start = formatProgramMonthDay(startDate);
  const end = formatProgramMonthDay(endDate);

  if (start && end) {
    return `${start} ~ ${end}`;
  }

  if (start) {
    return `${start} ~ 정보 없음`;
  }

  if (end) {
    return `정보 없음 ~ ${end}`;
  }

  return "정보 없음";
}

export function parseProgramDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null;

  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (Number.isNaN(date.getTime())) return null;

  return date;
}

export function toProgramDateKey(value: string | Date | null | undefined): string | null {
  const date = parseProgramDate(value);
  if (!date) return null;

  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function isSameProgramDate(
  left: string | Date | null | undefined,
  right: string | Date | null | undefined
): boolean {
  const leftDate = parseProgramDate(left);
  const rightDate = parseProgramDate(right);

  if (!leftDate || !rightDate) {
    return false;
  }

  return (
    leftDate.getFullYear() === rightDate.getFullYear() &&
    leftDate.getMonth() === rightDate.getMonth() &&
    leftDate.getDate() === rightDate.getDate()
  );
}

export function formatProgramDeadlineDate(value: string | null | undefined): string {
  const formatted = formatProgramMonthDay(value);
  return formatted ? `${formatted}까지` : "정보 없음";
}

export function formatProgramDeadlineCountdown(
  daysLeft: number | null | undefined
): string {
  if (typeof daysLeft !== "number" || Number.isNaN(daysLeft)) {
    return "정보 없음";
  }

  if (daysLeft < 0) return "마감";
  if (daysLeft === 0) return "D-Day";
  return `D-${daysLeft}`;
}

export function getProgramDeadlineTone(
  daysLeft: number | null | undefined
): string {
  if (typeof daysLeft !== "number") return "bg-slate-100 text-slate-600";
  if (daysLeft <= 3) return "bg-rose-100 text-rose-700";
  if (daysLeft <= 7) return "bg-amber-100 text-amber-700";
  return "bg-emerald-100 text-emerald-700";
}

export function toProgramScorePercent(score: number | null | undefined): number | null {
  if (typeof score !== "number" || Number.isNaN(score)) {
    return null;
  }

  return Math.max(0, Math.min(100, Math.round(score <= 1 ? score * 100 : score)));
}

export function formatProgramRelevanceText(
  score: number | null | undefined,
  prefix = "관련도"
): string {
  const percent = toProgramScorePercent(score);
  return `${prefix} ${percent ?? 0}%`;
}

export function formatProgramSourceLabel(
  source: string | null | undefined,
  options: SourceLabelOptions = {}
): string {
  if (!source) {
    return options.unknownLabel ?? "출처 미상";
  }

  if (source === "work24_training") {
    return options.work24TrainingLabel ?? "Work24 훈련과정";
  }

  return source;
}

export function getProgramPrimaryLink(program: ProgramLinks | null | undefined): string | null {
  return program?.application_url || program?.link || program?.source_url || null;
}

export function getProgramCompareMeta(program: ProgramCardRenderable): CompareMeta | null {
  if ("compare_meta" in program && program.compare_meta) {
    return program.compare_meta;
  }

  return null;
}

export function toProgramSelectSummary(
  program: ProgramCardRenderable | null | undefined
): ProgramSelectSummary | null {
  if (!program) {
    return null;
  }

  const id = getProgramId(program);
  if (!id) {
    return null;
  }

  return {
    id,
    title: program.title ?? null,
    category: program.category ?? null,
    provider: program.provider ?? null,
    source: program.source ?? null,
    tags: program.tags ?? null,
    days_left: program.days_left ?? null,
    compare_meta: getProgramCompareMeta(program),
  };
}

export function toProgramSelectSummaries(
  programs: Array<ProgramCardRenderable | null | undefined>
): ProgramSelectSummary[] {
  return programs
    .map((program) => toProgramSelectSummary(program))
    .filter((program): program is ProgramSelectSummary => Boolean(program));
}

export function unwrapProgramListRows(
  items: Array<ProgramListRowItem | null | undefined>
): ProgramListRow[] {
  return items
    .map((item) => item?.program ?? null)
    .filter((program): program is ProgramListRow => Boolean(program));
}

export type ProgramSelectCardProgram = ProgramSelectSummary;
