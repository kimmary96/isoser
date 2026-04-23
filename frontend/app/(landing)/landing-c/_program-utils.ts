import {
  getProgramDeadlineTone,
} from "../../../components/landing/program-card-helpers";
import type { Program } from "@/lib/types";

import { OPPORTUNITY_FEED_SIZE, SEOUL_DISTRICTS, liveBoardSources } from "./_content";

const LIVE_BOARD_LIMIT = liveBoardSources.length;

export function sourceLabel(program: Program): string {
  return [program.source || program.provider, locationLabel(program)].filter(Boolean).join(" · ") || "프로그램 정보";
}

export function isWork24Program(program: Program): boolean {
  const sourceText = [program.source, program.provider].filter(Boolean).join(" ").toLowerCase();
  return sourceText.includes("고용24") || sourceText.includes("work24");
}

export function providerLabel(program: Program): string {
  if (program.provider) {
    return program.provider;
  }

  const source = program.source?.toLowerCase();
  if (source === "sesac") {
    return "청년취업사관학교 SeSAC";
  }
  if (source?.includes("work24") || program.source === "고용24") {
    return "고용24";
  }

  return program.source || "운영 기관 확인 필요";
}

export function normalizeMetaText(value: string | boolean | null | undefined): string | null {
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

function formatWon(value: string | number | null | undefined): string | null {
  const amount = parseMetricNumber(value);
  if (amount === null) {
    return null;
  }

  if (amount === 0) {
    return "무료";
  }

  return `${amount.toLocaleString("ko-KR")}원`;
}

function trainingFeeLabel(program: Program): string {
  return formatWon(program.cost) || normalizeMetaText(program.compare_meta?.subsidy_rate) || "확인 필요";
}

function hasTomorrowLearningCardRequirement(program: Program): boolean {
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

export function trainingPeriodLabel(program: Program): string {
  if (program.start_date || program.end_date) {
    return [program.start_date || "시작일 미정", program.end_date || "종료일 미정"].join(" ~ ");
  }

  const titlePeriod = extractPeriodFromTitle(program.title);
  if (titlePeriod) {
    return titlePeriod;
  }

  return program.deadline ? `모집 마감 ${program.deadline}` : "일정 확인 필요";
}

export function displayTitle(program: Program): string {
  const title = program.title || "제목 미정";
  return title
    .replace(/\s*모집\s*기간\s*\d{4}[.-]\d{2}[.-]\d{2}\s*-\s*\d{4}[.-]\d{2}[.-]\d{2}\s*\d*\s*$/u, "")
    .replace(/^모집예정\s+/u, "")
    .trim() || title;
}

function extractPeriodFromTitle(title: string | null | undefined): string | null {
  const match = title?.match(/모집\s*기간\s*(\d{4})[.-](\d{2})[.-](\d{2})\s*-\s*(\d{4})[.-](\d{2})[.-](\d{2})/u);
  if (!match) {
    return null;
  }

  const [, startYear, startMonth, startDay, endYear, endMonth, endDay] = match;
  return `모집 ${startYear}-${startMonth}-${startDay} ~ ${endYear}-${endMonth}-${endDay}`;
}

function compactDistrictLocation(location: string): string {
  const normalized = location.replace(/\([^)]*\)/g, " ").replace(/\s+/g, " ").trim();
  const attachedDistrict = normalized.match(/^(서울특별시|서울시|서울)\s*([가-힣]+구)/u);
  if (attachedDistrict) {
    return `${attachedDistrict[1]} ${attachedDistrict[2]}`;
  }

  const tokens = normalized.split(" ");
  const districtIndex = tokens.findIndex((token) => /[가-힣]+(구|군)$/u.test(token));
  if (districtIndex >= 0) {
    return tokens.slice(0, districtIndex + 1).join(" ");
  }

  return normalized;
}

export function locationLabel(program: Program): string | null {
  const location = normalizeMetaText(program.location);
  if (location) {
    if (/온라인|비대면|원격/i.test(location)) {
      return null;
    }
    return compactDistrictLocation(location);
  }

  const title = program.title || "";
  const district = SEOUL_DISTRICTS.find((name) => title.includes(name));
  return district ? `서울 ${district}구` : null;
}

function trainingModeLabel(program: Program): "온라인" | "오프라인" | "온·오프라인" | null {
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
  if (hasOffline || locationLabel(program)) {
    return "오프라인";
  }
  return null;
}

export function programTagItems(program: Program): Array<{ label: string; tone: "green" | "blue" | "amber" | "indigo" }> {
  const tags: Array<{ label: string; tone: "green" | "blue" | "amber" | "indigo" }> = [
    { label: `훈련비 ${trainingFeeLabel(program)}`, tone: "green" },
  ];

  const trainingMode = trainingModeLabel(program);
  if (trainingMode) {
    tags.push({ label: trainingMode, tone: "indigo" });
  }

  const location = locationLabel(program);
  if (location) {
    tags.push({ label: location, tone: "blue" });
  }

  if (hasTomorrowLearningCardRequirement(program)) {
    tags.push({ label: "내배카 필수", tone: "amber" });
  }

  const rating = programRatingDisplay(program);
  if (rating !== null) {
    tags.push({ label: `만족도 ${rating}`, tone: "indigo" });
  }

  return tags;
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

function programRatingDisplay(program: Program): string | null {
  return (
    program.rating_display ||
    normalizeProgramRatingDisplay(program.rating) ||
    normalizeProgramRatingDisplay(program.compare_meta?.satisfaction_score)
  );
}

function programRatingValue(program: Program): number {
  const rating = parseMetricNumber(program.rating_display) ?? parseMetricNumber(program.rating) ?? parseMetricNumber(program.compare_meta?.satisfaction_score);
  if (rating === null || rating <= 0) {
    return 0;
  }
  return rating <= 5 ? rating : rating / 20;
}

function programReviewCount(program: Program): number {
  return parseMetricNumber(program.review_count) ?? 0;
}

function programRecommendedScore(program: Program): number {
  return typeof program.recommended_score === "number" && Number.isFinite(program.recommended_score) ? program.recommended_score : 0;
}

function opportunityCompletenessScore(program: Program): number {
  let score = 0;
  if (program.provider) score += 3;
  if (program.start_date || program.end_date) score += 3;
  else if (extractPeriodFromTitle(program.title) || program.deadline) score += 1;
  if (locationLabel(program)) score += 2;
  if (program.cost !== null && program.cost !== undefined) score += 1;
  if (programRatingDisplay(program) !== null) score += 1;
  return score;
}

function programDaysLeft(program: Program): number | null {
  if (typeof program.days_left === "number" && Number.isFinite(program.days_left)) {
    return program.days_left;
  }

  const timestamp = Date.parse(String(program.deadline || ""));
  if (Number.isNaN(timestamp)) {
    return null;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const deadline = new Date(timestamp);
  deadline.setHours(0, 0, 0, 0);
  return Math.round((deadline.getTime() - today.getTime()) / 86_400_000);
}

function isRecruitingProgram(program: Program, minDaysLeft = 0): boolean {
  const daysLeft = programDaysLeft(program);
  return daysLeft !== null && daysLeft >= minDaysLeft;
}

function parseDeadlineTime(program: Program): number {
  const timestamp = Date.parse(String(program.deadline || ""));
  return Number.isNaN(timestamp) ? Number.MAX_SAFE_INTEGER : timestamp;
}

function compareDescending(left: number, right: number): number {
  return right - left;
}

function compareAscending(left: number, right: number): number {
  return left - right;
}

function compareProgramsByHotness(left: Program, right: Program): number {
  return (
    compareDescending(programRatingValue(left), programRatingValue(right)) ||
    compareDescending(programReviewCount(left), programReviewCount(right)) ||
    compareDescending(programRecommendedScore(left), programRecommendedScore(right)) ||
    compareDescending(opportunityCompletenessScore(left), opportunityCompletenessScore(right)) ||
    compareAscending(programDaysLeft(left) ?? Number.MAX_SAFE_INTEGER, programDaysLeft(right) ?? Number.MAX_SAFE_INTEGER) ||
    compareAscending(parseDeadlineTime(left), parseDeadlineTime(right))
  );
}

function compareProgramsByUrgency(left: Program, right: Program): number {
  return (
    compareAscending(programDaysLeft(left) ?? Number.MAX_SAFE_INTEGER, programDaysLeft(right) ?? Number.MAX_SAFE_INTEGER) ||
    compareProgramsByHotness(left, right)
  );
}

type OpportunityOrderingOptions = {
  activeChip?: string;
  limit?: number;
};

export function orderOpportunityPrograms(programs: Program[], options?: OpportunityOrderingOptions): Program[] {
  const limit = options?.limit ?? OPPORTUNITY_FEED_SIZE;
  const isAllChip = !options?.activeChip || options.activeChip === "전체";
  const minimumDaysLeft = isAllChip ? 1 : 0;
  const recruitingPrograms = programs.filter((program) => isRecruitingProgram(program, minimumDaysLeft));
  const fallbackPrograms =
    recruitingPrograms.length >= limit ? recruitingPrograms : programs.filter((program) => isRecruitingProgram(program, 0));
  const comparePrograms = isAllChip ? compareProgramsByHotness : compareProgramsByUrgency;

  return fallbackPrograms
    .map((program, index) => ({ program, index }))
    .toSorted((left, right) => comparePrograms(left.program, right.program) || left.index - right.index)
    .map(({ program }) => program)
    .slice(0, limit);
}

export function getLiveBoardPrograms(programs: Program[]): Program[] {
  const weekPrograms = programs.filter((program) => {
    const daysLeft = programDaysLeft(program);
    return daysLeft !== null && daysLeft >= 0 && daysLeft <= 7;
  });
  const fallbackPrograms = weekPrograms.length >= LIVE_BOARD_LIMIT ? weekPrograms : programs.filter((program) => isRecruitingProgram(program, 0));

  return fallbackPrograms
    .map((program, index) => ({ program, index }))
    .toSorted((left, right) => compareProgramsByHotness(left.program, right.program) || left.index - right.index)
    .map(({ program }) => program)
    .slice(0, LIVE_BOARD_LIMIT);
}

export { getProgramDeadlineTone };
