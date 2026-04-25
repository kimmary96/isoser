import type { ProgramListRow, ProgramSort } from "@/lib/types";

import { isDisplayableProgram } from "./program-utils";

type PromotionMergeArgs = {
  organicPrograms: ProgramListRow[];
  promotedPrograms: ProgramListRow[];
  pinPromoted: boolean;
  promotedLimit?: number;
};

type PinPromotedArgs = {
  q: string;
  selectedCategoryId: string;
  selectedRegionsCount: number;
  selectedTeachingMethodsCount: number;
  selectedCostTypesCount: number;
  selectedParticipationTimesCount: number;
  selectedSourcesCount: number;
  selectedTargetsCount: number;
  showClosedRecent: boolean;
  sort: ProgramSort;
};

type ProgramsDisplayStateArgs = PinPromotedArgs & {
  programs: ProgramListRow[];
  promotedPrograms: ProgramListRow[];
  urgentPrograms: ProgramListRow[];
};

const DEFAULT_PROMOTED_LIMIT = 3;

const KEYWORD_TONE_CLASSES = [
  "bg-violet-50 text-violet-700",
  "bg-sky-50 text-sky-700",
  "bg-emerald-50 text-emerald-700",
  "bg-amber-50 text-amber-700",
  "bg-rose-50 text-rose-700",
  "bg-cyan-50 text-cyan-700",
] as const;

function normalizeProgramId(program: ProgramListRow): string {
  return String(program.id ?? "").trim();
}

function totalHoursLabel(detail: string | null | undefined): string | null {
  const match = detail?.match(/총\s*(\d+(?:\.\d+)?)\s*시간/u);
  if (!match) {
    const normalized = detail?.trim() || null;
    if (!normalized || /곧\s*마감|마감\s*임박|d-\d+|d-day|모집중/iu.test(normalized)) {
      return null;
    }
    return normalized;
  }
  return `${match[1]}시간`;
}

function hashKeywordTone(keyword: string): string {
  const hash = Array.from(keyword).reduce((total, char) => total + char.charCodeAt(0), 0);
  return KEYWORD_TONE_CLASSES[hash % KEYWORD_TONE_CLASSES.length];
}

export function formatProgramParticipationTime(
  program: Pick<ProgramListRow, "participation_mode_label" | "participation_time" | "participation_time_text">
): { label: string | null; detail: string | null } {
  const rawLabel =
    program.participation_mode_label ||
    (program.participation_time === "full-time"
      ? "풀타임"
      : program.participation_time === "part-time"
        ? "파트타임"
        : program.participation_time || null);
  const label = rawLabel && !/곧\s*마감|마감\s*임박|d-\d+|d-day|모집중/iu.test(rawLabel) ? rawLabel : null;
  const detail = totalHoursLabel(program.participation_time_text || null);
  return { label, detail };
}

export function getSelectionKeywordTone(keyword: string): string {
  const normalizedKeyword = keyword.trim().toLowerCase();
  if (!normalizedKeyword) {
    return "bg-slate-100 text-slate-600";
  }

  if (/(면접|인터뷰|서류|신청서|자소서|포트폴리오)/u.test(normalizedKeyword)) {
    return "bg-rose-50 text-rose-700";
  }
  if (/(코딩|테스트|역량|평가|알고리즘|필기)/u.test(normalizedKeyword)) {
    return "bg-violet-50 text-violet-700";
  }
  if (/(ai|llm|python|data|sql|cloud|react|java|개발|보안|데이터|클라우드)/u.test(normalizedKeyword)) {
    return "bg-sky-50 text-sky-700";
  }
  if (/(취업|채용|멘토링|창업|고용보험|커리어|네트워킹)/u.test(normalizedKeyword)) {
    return "bg-emerald-50 text-emerald-700";
  }
  if (/(디자인|ux|ui|브랜딩|포토샵|3d|그래픽)/u.test(normalizedKeyword)) {
    return "bg-amber-50 text-amber-700";
  }

  return hashKeywordTone(normalizedKeyword);
}

export function mergeProgramsForDisplay({
  organicPrograms,
  promotedPrograms,
  pinPromoted,
  promotedLimit = DEFAULT_PROMOTED_LIMIT,
}: PromotionMergeArgs): ProgramListRow[] {
  const promotedSlice = promotedPrograms.slice(0, promotedLimit);
  const merged = pinPromoted ? [...promotedSlice, ...organicPrograms] : [...organicPrograms, ...promotedSlice];
  const seenIds = new Set<string>();

  return merged.filter((program) => {
    const programId = normalizeProgramId(program);
    const dedupeKey = programId || `${program.source || ""}-${program.title || ""}`;
    if (!dedupeKey || seenIds.has(dedupeKey)) {
      return false;
    }
    seenIds.add(dedupeKey);
    return true;
  });
}

export function shouldPinPromotedPrograms({
  q,
  selectedCategoryId,
  selectedRegionsCount,
  selectedTeachingMethodsCount,
  selectedCostTypesCount,
  selectedParticipationTimesCount,
  selectedSourcesCount,
  selectedTargetsCount,
  showClosedRecent,
  sort,
}: PinPromotedArgs): boolean {
  return Boolean(
    !q &&
      selectedCategoryId === "all" &&
      selectedRegionsCount === 0 &&
      selectedTeachingMethodsCount === 0 &&
      selectedCostTypesCount === 0 &&
      selectedParticipationTimesCount === 0 &&
      selectedSourcesCount === 0 &&
      selectedTargetsCount === 0 &&
      !showClosedRecent &&
      sort === "default"
  );
}

export function buildProgramsDisplayState({
  programs,
  promotedPrograms,
  urgentPrograms,
  ...pinArgs
}: ProgramsDisplayStateArgs): {
  tablePrograms: ProgramListRow[];
  displayUrgentPrograms: ProgramListRow[];
  urgentProgramsUseStrictWindow: boolean;
  urgentProgramsUseUpcomingFallback: boolean;
} {
  const displayPrograms = programs.filter(isDisplayableProgram);
  const displayPromotedPrograms = promotedPrograms.filter(isDisplayableProgram);
  const pinPromotedPrograms = shouldPinPromotedPrograms(pinArgs);
  const tablePrograms = mergeProgramsForDisplay({
    organicPrograms: displayPrograms,
    promotedPrograms: displayPromotedPrograms,
    pinPromoted: pinPromotedPrograms,
  });
  const urgentSourcePrograms = urgentPrograms.length > 0 ? urgentPrograms : tablePrograms;
  const rankedUrgentPrograms = urgentSourcePrograms
    .filter(isDisplayableProgram)
    .toSorted((left, right) => {
      const leftDays = typeof left.days_left === "number" ? left.days_left : Number.MAX_SAFE_INTEGER;
      const rightDays = typeof right.days_left === "number" ? right.days_left : Number.MAX_SAFE_INTEGER;
      return leftDays - rightDays;
    });
  const strictUrgentPrograms = rankedUrgentPrograms.filter(
    (program) => typeof program.days_left === "number" && program.days_left >= 0 && program.days_left <= 7
  );
  const upcomingPrograms = rankedUrgentPrograms.filter((program) => typeof program.days_left === "number" && program.days_left >= 0);
  const displayUrgentPrograms = (strictUrgentPrograms.length > 0
    ? strictUrgentPrograms
    : upcomingPrograms.length > 0
      ? upcomingPrograms
      : rankedUrgentPrograms)
    .slice(0, 6);
  const urgentProgramsUseStrictWindow = strictUrgentPrograms.length > 0;
  const urgentProgramsUseUpcomingFallback = !urgentProgramsUseStrictWindow && upcomingPrograms.length > 0;

  return {
    tablePrograms,
    displayUrgentPrograms,
    urgentProgramsUseStrictWindow,
    urgentProgramsUseUpcomingFallback,
  };
}
