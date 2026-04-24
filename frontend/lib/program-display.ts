import type {
  CompareMeta,
  ProgramBaseSummary,
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

function cleanText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
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

type ProgramDeadlineTrustSource = Pick<
  ProgramBaseSummary,
  "deadline" | "end_date" | "source" | "deadline_confidence"
> & {
  compare_meta?: CompareMeta | null;
};

function hasTrainingStartDeadlineSource(compareMeta: CompareMeta | null | undefined): boolean {
  const deadlineSource = String(
    compareMeta?.deadline_source ||
      compareMeta?.application_deadline_source ||
      compareMeta?.recruitment_deadline_source ||
      "",
  )
    .replace(/[_-]/g, "")
    .toLowerCase();

  return (
    deadlineSource === "trastartdate" ||
    deadlineSource === "trainingstartdate" ||
    deadlineSource === "trainingstart"
  );
}

export function hasTrustedProgramDeadline(
  program: ProgramDeadlineTrustSource | null | undefined
): boolean {
  if (!program?.deadline) {
    return false;
  }

  if (program.deadline_confidence === "low") {
    return false;
  }

  const deadline = String(program.deadline).slice(0, 10);
  const endDate = String(program.end_date ?? "").slice(0, 10);
  const compareMeta = program.compare_meta;
  const metaDeadline =
    compareMeta?.application_deadline ||
    compareMeta?.application_end_date ||
    compareMeta?.recruitment_deadline ||
    compareMeta?.recruitment_end_date;
  const source = String(program.source ?? "").toLowerCase();
  const isWork24 = source.includes("고용24") || source.includes("work24");

  if (
    isWork24 &&
    endDate &&
    deadline === endDate &&
    !metaDeadline &&
    !hasTrainingStartDeadlineSource(compareMeta)
  ) {
    return false;
  }

  return true;
}

type ProgramInsightSource = Pick<
  ProgramCardSummary,
  | "cost"
  | "support_type"
  | "subsidy_amount"
  | "teaching_method"
  | "application_method"
  | "location"
  | "title"
  | "summary"
  | "description"
  | "rating"
  | "rating_display"
  | "review_count"
> & {
  compare_meta?: CompareMeta | null;
};

function normalizeMetaText(value: string | boolean | null | undefined): string | null {
  if (typeof value === "boolean") {
    return value ? "필수" : null;
  }

  const text = value?.trim();
  return text ? text : null;
}

function parseMetricNumber(value: string | number | null | undefined): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  const normalized = value?.replace(/,/g, "").match(/\d+(?:\.\d+)?/)?.[0];
  if (!normalized) {
    return null;
  }

  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeProgramRatingDisplay(value: string | number | null | undefined): string | null {
  if (typeof value === "string" && /(^|[^\d])\.\d/u.test(value.trim())) {
    return null;
  }

  const rating = parseMetricNumber(value);
  if (rating === null || rating <= 0 || rating > 100) {
    return null;
  }

  const normalizedRating = rating <= 5 ? rating : rating / 20;
  return normalizedRating.toFixed(1);
}

export function formatProgramCostLabel(program: ProgramInsightSource): string | null {
  const directCost = parseMetricNumber(program.cost);
  if (directCost !== null) {
    return directCost === 0 ? "무료" : `${directCost.toLocaleString("ko-KR")}원`;
  }

  if (typeof program.cost === "string" && program.cost.trim()) {
    return program.cost.trim();
  }

  if (typeof program.support_type === "string" && program.support_type.trim()) {
    return program.support_type.trim();
  }

  return normalizeMetaText(program.compare_meta?.subsidy_rate);
}

export function getProgramSupportBadge(program: ProgramInsightSource): string | null {
  const text = [
    program.support_type,
    program.compare_meta?.training_type,
    program.summary,
    program.description,
    program.title,
  ]
    .filter((value): value is string => typeof value === "string" && value.trim().length > 0)
    .join(" ");

  if (/K[-\s]?Digital|KDT|디지털\s*트레이닝/i.test(text)) return "KDT";
  if (/산업구조변화|산대특/.test(text)) return "산대특";
  if (/국가기간|전략산업직종|국기/.test(text)) return "국기";
  if (/내일배움|국민내일배움/.test(text)) return "내일배움";

  const explicit = program.support_type?.trim();
  return explicit && explicit.length <= 8 ? explicit : null;
}

export function hasTomorrowLearningCardRequirement(program: ProgramInsightSource): boolean {
  const explicit = program.compare_meta?.naeilbaeumcard_required;
  if (explicit === true || explicit === "pass" || explicit === "block") {
    return true;
  }

  const text = [
    program.support_type,
    program.description,
    program.summary,
    program.compare_meta?.target_group,
  ]
    .filter(Boolean)
    .join(" ");

  return /내일배움카드|국민내일배움카드|내배카/.test(text);
}

export function getProgramTrainingModeLabel(
  program: Pick<ProgramInsightSource, "teaching_method" | "application_method" | "location" | "title"> & {
    compare_meta?: CompareMeta | null;
  }
): "온라인" | "오프라인" | "온·오프라인" | null {
  const text = [
    program.teaching_method,
    program.compare_meta?.teaching_method,
    program.application_method,
    program.location,
    program.title,
  ]
    .filter(Boolean)
    .join(" ");

  const hasOnline = /온라인|비대면|원격|zoom|줌|인터넷/i.test(text);
  const hasOffline = /오프라인|대면|집체|현장|방문/i.test(text);
  if (/혼합|온.?오프|블렌디드/i.test(text) || (hasOnline && hasOffline)) {
    return "온·오프라인";
  }
  if (hasOnline) {
    return "온라인";
  }
  if (hasOffline || cleanText(program.location)) {
    return "오프라인";
  }
  return null;
}

export function getProgramRatingDisplay(program: ProgramInsightSource): string | null {
  return (
    cleanText(program.rating_display) ||
    normalizeProgramRatingDisplay(program.rating) ||
    normalizeProgramRatingDisplay(program.compare_meta?.satisfaction_score)
  );
}

export function getProgramRatingValue(program: ProgramInsightSource): number {
  const rating =
    parseMetricNumber(program.rating_display) ??
    parseMetricNumber(program.rating) ??
    parseMetricNumber(program.compare_meta?.satisfaction_score);
  if (rating === null || rating <= 0) {
    return 0;
  }

  return rating <= 5 ? rating : rating / 20;
}

export function getProgramSelectionKeywords(program: ProgramListRow): string[] {
  const meta = program.compare_meta;
  const candidates = [
    meta?.coding_skill_required ? "코딩역량" : null,
    meta?.portfolio_required ? "포트폴리오" : null,
    meta?.interview_required ? "면접" : null,
    ...normalizeProgramTextList(program.extracted_keywords),
    meta?.employment_insurance ? "고용보험" : null,
    ...normalizeProgramTextList(program.tags),
    ...normalizeProgramTextList(program.skills),
  ];

  const seen = new Set<string>();
  return candidates
    .flatMap((value) => (typeof value === "string" ? value.split("/") : []))
    .map((value) => value.trim())
    .filter((value) => {
      if (!value || seen.has(value)) {
        return false;
      }
      seen.add(value);
      return true;
    })
    .slice(0, 8);
}

export function toProgramSelectSummary(
  program:
    | (Pick<
        ProgramBaseSummary,
        "id" | "title" | "category" | "provider" | "source" | "days_left" | "support_type"
      > & {
        tags?: string[] | string | null;
      })
    | null
    | undefined
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
    support_type: program.support_type ?? null,
  };
}

export function toProgramSelectSummaries(
  programs: Array<
    | (Pick<
        ProgramBaseSummary,
        "id" | "title" | "category" | "provider" | "source" | "days_left" | "support_type"
      > & {
        tags?: string[] | string | null;
      })
    | null
    | undefined
  >
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
