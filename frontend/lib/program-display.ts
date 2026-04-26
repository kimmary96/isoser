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
type ProgramLegacyMetaCarrier = { compare_meta?: CompareMeta | null };
type LegacyMetaRecord = Record<string, unknown>;

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

function getLegacyProgramMeta(
  program: ProgramLegacyMetaCarrier | null | undefined
): CompareMeta | null {
  return program?.compare_meta ?? null;
}

function getLegacyProgramMetaRecord(
  program: ProgramLegacyMetaCarrier | null | undefined
): LegacyMetaRecord | null {
  const compareMeta = getLegacyProgramMeta(program);
  if (!compareMeta || typeof compareMeta !== "object" || Array.isArray(compareMeta)) {
    return null;
  }

  return compareMeta as LegacyMetaRecord;
}

function getLegacyMetaValue(
  compareMeta: LegacyMetaRecord | null,
  keys: readonly string[]
): unknown {
  if (!compareMeta) {
    return null;
  }

  for (const key of keys) {
    const value = compareMeta[key];
    if (typeof value === "string") {
      if (value.trim()) {
        return value;
      }
      continue;
    }

    if (value !== null && value !== undefined) {
      return value;
    }
  }

  return null;
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

function normalizeProgramDateText(value: unknown): string | null {
  if (value instanceof Date) {
    return toProgramDateKey(value);
  }

  const text = cleanText(value);
  if (!text) {
    return null;
  }

  const matched = text.match(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})/u);
  if (matched) {
    const [, year, month, day] = matched;
    return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
  }

  return toProgramDateKey(text);
}

export function formatProgramDateRangeLabel(
  startDate: string | Date | null | undefined,
  endDate: string | Date | null | undefined,
  options: {
    sameDaySingleLabel?: boolean;
    unknownLabel?: string | null;
  } = {}
): string | null {
  const start = normalizeProgramDateText(startDate);
  const end = normalizeProgramDateText(endDate);
  const sameDaySingleLabel = options.sameDaySingleLabel ?? true;

  if (!start && !end) {
    return options.unknownLabel ?? null;
  }

  if (start && end) {
    if (sameDaySingleLabel && start === end) {
      return start;
    }
    return `${start} ~ ${end}`;
  }

  return start ?? end ?? options.unknownLabel ?? null;
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
> &
  ProgramLegacyMetaCarrier;

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
  const compareMeta = getLegacyProgramMeta(program);
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
  | "support_amount"
  | "verified_self_pay_amount"
  | "support_type"
  | "subsidy_amount"
  | "teaching_method"
  | "application_method"
  | "location"
  | "title"
  | "summary"
  | "description"
  | "source"
  | "deadline"
  | "start_date"
  | "end_date"
  | "days_left"
  | "rating"
  | "rating_display"
  | "review_count"
> &
  ProgramLegacyMetaCarrier;

function normalizeMetaText(value: string | boolean | null | undefined): string | null {
  if (typeof value === "boolean") {
    return value ? "필수" : null;
  }

  const text = value?.trim();
  return text ? text : null;
}

function parseMetricNumber(value: unknown): number | null {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : null;
  }

  if (typeof value !== "string") {
    return null;
  }

  const normalized = value.replace(/,/g, "").match(/\d+(?:\.\d+)?/)?.[0];
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

function formatMetricWon(value: number | null): string | null {
  if (value === null) {
    return null;
  }
  return value === 0 ? "무료" : `${value.toLocaleString("ko-KR")}원`;
}

function hasExplicitFreeFundingText(text: string | null | undefined): boolean {
  return /무료|전액\s*지원|전액지원|100%\s*지원|100%\s*무료/u.test(text ?? "");
}

function hasAmbiguousSupportedFundingText(text: string | null | undefined): boolean {
  return /내일배움|국비|자부담|훈련비\s*지원|수강료\s*지원|지원/u.test(text ?? "");
}

export function getProgramOutOfPocketAmount(program: ProgramInsightSource): number | null {
  const compareMeta = getLegacyProgramMetaRecord(program);
  for (const value of [
    program.verified_self_pay_amount,
    program.support_amount,
    getLegacyMetaValue(compareMeta, ["self_payment", "selfPayment"]),
    getLegacyMetaValue(compareMeta, ["out_of_pocket", "outOfPocket"]),
    getLegacyMetaValue(compareMeta, ["out_of_pocket_amount", "outOfPocketAmount"]),
    getLegacyMetaValue(compareMeta, ["support_amount", "supportAmount"]),
  ]) {
    const parsed = parseMetricNumber(value);
    if (parsed !== null) {
      return Math.max(0, parsed);
    }
  }

  const directAmount =
    isWork24ProgramSource(program.source) ? null : parseMetricNumber(program.subsidy_amount);
  if (directAmount !== null) {
    return Math.max(0, directAmount);
  }

  return null;
}

export function formatProgramCostLabel(program: ProgramInsightSource): string | null {
  const compareMeta = getLegacyProgramMeta(program);
  const outOfPocketAmount = getProgramOutOfPocketAmount(program);
  if (outOfPocketAmount !== null) {
    return formatMetricWon(outOfPocketAmount);
  }

  const explicitSupportText =
    cleanText(program.support_type) ?? normalizeMetaText(compareMeta?.subsidy_rate);
  if (hasExplicitFreeFundingText(explicitSupportText)) {
    return explicitSupportText ?? "전액지원";
  }

  if (
    isWork24ProgramSource(program.source) ||
    hasAmbiguousSupportedFundingText(explicitSupportText)
  ) {
    return "자부담 정보 확인 필요";
  }

  const directCost = parseMetricNumber(program.cost);
  if (directCost !== null) {
    return formatMetricWon(directCost);
  }

  if (typeof program.cost === "string" && program.cost.trim()) {
    return program.cost.trim();
  }

  if (typeof program.support_type === "string" && program.support_type.trim()) {
    return program.support_type.trim();
  }

  return normalizeMetaText(compareMeta?.subsidy_rate);
}

export function getProgramSupportBadge(program: ProgramInsightSource): string | null {
  const compareMeta = getLegacyProgramMeta(program);
  const text = [
    program.support_type,
    compareMeta?.training_type,
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
  const compareMeta = getLegacyProgramMeta(program);
  const explicit = compareMeta?.naeilbaeumcard_required;
  if (explicit === true || explicit === "pass" || explicit === "block") {
    return true;
  }

  const text = [
    program.support_type,
    program.description,
    program.summary,
    compareMeta?.target_group,
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
  const compareMeta = getLegacyProgramMeta(program);
  const text = [
    program.teaching_method,
    compareMeta?.teaching_method,
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

function isWork24ProgramSource(source: string | null | undefined): boolean {
  const normalizedSource = String(source ?? "").toLowerCase();
  return normalizedSource.includes("고용24") || normalizedSource.includes("work24");
}

type ProgramScheduleRange = {
  startDate: string | null;
  endDate: string | null;
};

function extractProgramDateRangeFromText(
  value: string | null | undefined,
  options: { allowSingleDate?: boolean } = {}
): ProgramScheduleRange | null {
  const text = cleanText(value);
  if (!text) {
    return null;
  }

  if (/(모집|신청|접수)\s*(기간|마감)?/u.test(text) && !/(교육|운영|행사|개최|설명회|워크숍|세미나|데모데이)/u.test(text)) {
    return null;
  }

  const matches = Array.from(
    text.matchAll(/(\d{4})[./-](\d{1,2})[./-](\d{1,2})/gu)
  ).map((matched) => `${matched[1]}-${matched[2].padStart(2, "0")}-${matched[3].padStart(2, "0")}`);

  if (matches.length >= 2) {
    return {
      startDate: matches[0] ?? null,
      endDate: matches[1] ?? null,
    };
  }

  if (options.allowSingleDate && matches.length === 1) {
    return {
      startDate: matches[0] ?? null,
      endDate: matches[0] ?? null,
    };
  }

  return null;
}

function resolveProgramScheduleRange(program: ProgramInsightSource): ProgramScheduleRange | null {
  const compareMeta = getLegacyProgramMetaRecord(program);
  const rowStart = normalizeProgramDateText(program.start_date);
  const rowEnd = normalizeProgramDateText(program.end_date);
  const deadline = normalizeProgramDateText(program.deadline);
  const metaProgramStart = normalizeProgramDateText(
    getLegacyMetaValue(compareMeta, [
      "program_start_date",
      "programStartDate",
      "training_start_date",
      "trainingStartDate",
      "tra_start_date",
      "traStartDate",
      "course_start_date",
      "courseStartDate",
      "event_start_date",
      "eventStartDate",
    ])
  );
  const metaProgramEnd = normalizeProgramDateText(
    getLegacyMetaValue(compareMeta, [
      "program_end_date",
      "programEndDate",
      "training_end_date",
      "trainingEndDate",
      "tra_end_date",
      "traEndDate",
      "course_end_date",
      "courseEndDate",
      "event_end_date",
      "eventEndDate",
    ])
  );
  const metaApplicationStart = normalizeProgramDateText(
    getLegacyMetaValue(compareMeta, [
      "application_start_date",
      "applicationStartDate",
      "recruitment_start_date",
      "recruitmentStartDate",
      "registration_start_date",
      "registrationStartDate",
    ])
  );
  const metaApplicationEnd = normalizeProgramDateText(
    getLegacyMetaValue(compareMeta, [
      "application_end_date",
      "applicationEndDate",
      "application_deadline",
      "applicationDeadline",
      "recruitment_end_date",
      "recruitmentEndDate",
      "recruitment_deadline",
      "recruitmentDeadline",
    ])
  );

  if (isWork24ProgramSource(program.source)) {
    if (rowStart || rowEnd) {
      return {
        startDate: rowStart,
        endDate: rowEnd,
      };
    }

    if (metaProgramStart || metaProgramEnd) {
      return {
        startDate: metaProgramStart,
        endDate: metaProgramEnd,
      };
    }

    return null;
  }

  if (metaProgramStart || metaProgramEnd) {
    return {
      startDate: metaProgramStart,
      endDate: metaProgramEnd,
    };
  }

  for (const candidate of [
    getLegacyMetaValue(compareMeta, ["schedule_text", "scheduleText"]),
    getLegacyMetaValue(compareMeta, ["training_schedule", "trainingSchedule"]),
  ]) {
    const extracted =
      typeof candidate === "string"
        ? extractProgramDateRangeFromText(candidate, { allowSingleDate: true })
        : null;
    if (extracted) {
      return extracted;
    }
  }

  for (const candidate of [program.title, program.summary, program.description]) {
    const extracted = extractProgramDateRangeFromText(candidate);
    if (extracted) {
      return extracted;
    }
  }

  const rowLooksLikeApplicationRange =
    Boolean(rowEnd && deadline && rowEnd === deadline) ||
    Boolean(rowStart && metaApplicationStart && rowStart === metaApplicationStart) ||
    Boolean(rowEnd && metaApplicationEnd && rowEnd === metaApplicationEnd);

  if (!rowLooksLikeApplicationRange && (rowStart || rowEnd)) {
    return {
      startDate: rowStart,
      endDate: rowEnd,
    };
  }

  return null;
}

export function formatProgramScheduleLabel(
  program: ProgramInsightSource,
  options: {
    unknownLabel?: string;
  } = {}
): string {
  const scheduleRange = resolveProgramScheduleRange(program);
  const label = formatProgramDateRangeLabel(scheduleRange?.startDate, scheduleRange?.endDate, {
    sameDaySingleLabel: true,
  });
  return label ?? options.unknownLabel ?? "일정 확인 필요";
}

export type ProgramDeadlineBadgeData = {
  label: string;
  tone: "critical" | "warning" | "normal" | "closed";
};

function resolveProgramDaysLeft(
  program: Pick<ProgramBaseSummary, "days_left" | "deadline">
): number | null {
  if (typeof program.days_left === "number" && Number.isFinite(program.days_left)) {
    return program.days_left;
  }

  const deadlineDateKey = normalizeProgramDateText(program.deadline);
  if (!deadlineDateKey) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(deadlineDateKey);
  deadline.setHours(0, 0, 0, 0);
  return Math.round((deadline.getTime() - today.getTime()) / 86_400_000);
}

export function getProgramDeadlineBadgeData(
  program: Pick<ProgramBaseSummary, "days_left" | "deadline">
): ProgramDeadlineBadgeData | null {
  const daysLeft = resolveProgramDaysLeft(program);
  if (daysLeft === null) {
    return null;
  }

  if (daysLeft < 0) {
    return { label: "마감", tone: "closed" };
  }

  if (daysLeft === 0) {
    return { label: "D-Day", tone: "critical" };
  }

  if (daysLeft <= 7) {
    return { label: `D-${daysLeft}`, tone: "warning" };
  }

  return {
    label: `D-${daysLeft}`,
    tone: "normal",
  };
}

export function getProgramRatingDisplay(program: ProgramInsightSource): string | null {
  const compareMeta = getLegacyProgramMeta(program);
  return (
    cleanText(program.rating_display) ||
    normalizeProgramRatingDisplay(program.rating) ||
    normalizeProgramRatingDisplay(compareMeta?.satisfaction_score)
  );
}

export function getProgramRatingValue(program: ProgramInsightSource): number {
  const compareMeta = getLegacyProgramMeta(program);
  const rating =
    parseMetricNumber(program.rating_display) ??
    parseMetricNumber(program.rating) ??
    parseMetricNumber(compareMeta?.satisfaction_score);
  if (rating === null || rating <= 0) {
    return 0;
  }

  return rating <= 5 ? rating : rating / 20;
}

export function getProgramSelectionKeywords(
  program: Pick<ProgramListRow, "extracted_keywords" | "tags" | "skills"> & ProgramLegacyMetaCarrier
): string[] {
  const meta = getLegacyProgramMeta(program);
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
