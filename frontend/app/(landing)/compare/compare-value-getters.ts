import type { ProgramCardSummary, ProgramDetail } from "@/lib/types";

import {
  formatCompareDateLabel,
  formatCompareDateRange,
  formatCompareMoney,
  getCompareOperationalText,
  getCompareText,
  getFirstCompareText,
  joinUniqueCompareText,
  normalizeTextList,
} from "./compare-formatters";

export type CompareProgram = ProgramCardSummary & {
  detail?: ProgramDetail | null;
};

export function getDeadlineLabel(daysLeft?: number | null): string {
  if (typeof daysLeft !== "number") return "정보 없음";
  if (daysLeft < 0) return "마감";
  if (daysLeft === 0) return "D-Day";
  return `D-${daysLeft}`;
}

export function getDeadlineTone(daysLeft?: number | null): string {
  if (typeof daysLeft !== "number") return "text-slate-500";
  if (daysLeft <= 3) return "text-rose-600";
  if (daysLeft <= 7) return "text-orange-500";
  if (daysLeft <= 14) return "text-amber-500";
  return "text-emerald-600";
}

export function getProgramSummary(program: CompareProgram | null): string {
  return getInformativeProgramSummary(program) ?? "정보 없음";
}

export function getProgramDescription(program: CompareProgram | null): string {
  return getInformativeProgramDescription(program) ?? "정보 없음";
}

export function getSourceLabel(program: CompareProgram | null): string {
  if (!program) return "정보 없음";
  return getCompareText(getFirstCompareText(program.source, program.detail?.organizer, program.provider));
}

export function getProviderLabel(program: CompareProgram | null): string {
  if (!program) return "정보 없음";
  return getCompareText(getFirstCompareText(program.detail?.provider, program.detail?.organizer, program.provider));
}

export function getLocationLabel(program: CompareProgram | null): string {
  if (!program) return "정보 없음";
  return getCompareText(getFirstCompareText(program.detail?.location, program.location));
}

export function getCategoryLabel(program: CompareProgram | null): string {
  if (!program) return "정보 없음";
  return joinUniqueCompareText([
    ...(program.detail?.display_categories ?? []),
    ...(program.display_categories ?? []),
    program.detail?.category_detail,
    program.category_detail,
    program.detail?.category,
    program.category,
  ]);
}

export function getNcsLabel(program: CompareProgram | null): string {
  if (!program) return "정보 없음";
  return joinUniqueCompareText([program.detail?.ncs_name, program.detail?.ncs_code]);
}

export function getApplicationPeriod(program: CompareProgram | null): string {
  if (!program) return "정보 없음";
  const detail = program.detail;
  if (detail?.application_start_date || detail?.application_end_date) {
    return formatCompareDateRange(detail.application_start_date, detail.application_end_date);
  }
  if (program.deadline) return `${formatCompareDateLabel(program.deadline)} 마감`;
  return "데이터 미수집";
}

export function getProgramPeriod(program: CompareProgram | null): string {
  if (!program) return "정보 없음";
  const detail = program.detail;
  if (detail?.program_start_date || detail?.program_end_date) {
    return formatCompareDateRange(detail.program_start_date, detail.program_end_date);
  }
  if (program.start_date || program.end_date) return formatCompareDateRange(program.start_date, program.end_date);
  return "데이터 미수집";
}

export function getFeeLabel(program: CompareProgram | null): string {
  if (!program) return "정보 없음";
  return formatCompareMoney(program.detail?.fee ?? program.cost) ?? "데이터 미수집";
}

export function getSupportAmountLabel(program: CompareProgram | null): string {
  if (!program) return "정보 없음";
  return formatCompareMoney(program.detail?.support_amount ?? program.subsidy_amount) ?? getCompareOperationalText(program.detail?.support_type ?? program.support_type);
}

function getCompareMetaValue(program: CompareProgram | null, ...keys: string[]): unknown {
  const meta = program?.compare_meta;
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return null;
  const record = meta as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return null;
}

function getRawRatingValue(program: CompareProgram | null): unknown {
  return (
    program?.detail?.rating_display ??
    program?.rating_display ??
    program?.detail?.rating ??
    program?.rating ??
    getCompareMetaValue(program, "satisfaction_score", "stdgScor")
  );
}

function parseCompareNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return null;
  const parsed = Number(value.replace(/,/g, "").match(/\d+(?:\.\d+)?/)?.[0] ?? "");
  return Number.isFinite(parsed) ? parsed : null;
}

export function getParticipationLabel(program: CompareProgram | null): string {
  if (!program) return "정보 없음";
  return joinUniqueCompareText(
    [
      program.detail?.participation_time,
      program.detail?.participation_time_text,
      program.participation_time,
      program.participation_mode_label,
      program.participation_time_text,
    ],
    " · "
  );
}

export function getEligibilityLabel(program: CompareProgram | null): string {
  if (!program) return "정보 없음";
  const eligibility = program.detail?.eligibility ?? normalizeTextList(program.tags);
  return eligibility.length > 0 ? eligibility.join(", ") : "데이터 미수집";
}

export function getCapacityLabel(program: CompareProgram | null): string {
  if (!program) return "정보 없음";
  const remaining = program.detail?.capacity_remaining;
  const total = program.detail?.capacity_total;
  if (typeof remaining === "number" && typeof total === "number") return `${remaining}/${total}명`;
  if (typeof total === "number") return `${total}명`;
  return "데이터 미수집";
}

export function getRatingLabel(program: CompareProgram | null): string {
  if (!program) return "정보 없음";
  const rating = parseCompareNumber(getRawRatingValue(program));
  if (rating === null) return "데이터 미수집";
  if (rating <= 0) return "평점 없음";
  const normalized = rating <= 5 ? rating : rating / 20;
  return `${normalized.toFixed(1)} / 5`;
}

export function getContactLabel(program: CompareProgram | null): string {
  if (!program) return "정보 없음";
  const detail = program.detail;
  const contact = [detail?.manager_name, detail?.phone, detail?.email].filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0
  );
  return contact.length > 0 ? contact.join(" · ") : "데이터 미수집";
}

export function getLinkHref(program: CompareProgram | null): string | null {
  if (!program) return null;
  const candidates = [program.application_url, program.detail?.source_url, program.source_url, program.link];
  return candidates.find((value): value is string => typeof value === "string" && value.trim().length > 0) ?? null;
}

export function getLinkSummary(program: CompareProgram | null): string {
  return getLinkHref(program) ? "바로가기 가능" : "링크 없음";
}

export function getApplicationMethodLabel(program: CompareProgram | null): string {
  if (!program) return "정보 없음";
  const explicit = getFirstCompareText(program.detail?.application_method, program.application_method);
  if (explicit) return getCompareOperationalText(explicit);
  if (getLinkHref(program)) {
    const source = getSourceLabel(program);
    return source !== "정보 없음" ? `${source}에서 신청 정보 확인` : "지원 링크에서 신청 정보 확인";
  }
  return "데이터 미수집";
}

export function getSelectionProcessLabel(program: CompareProgram | null): string {
  if (!program) return "정보 없음";
  const explicit = getFirstCompareText(program.detail?.selection_process_label, program.selection_process_label);
  if (explicit) return getCompareOperationalText(explicit);
  if (getLinkHref(program)) return "원천 상세에서 확인 필요";
  return "데이터 미수집";
}

export function getSupportTypeLabel(program: CompareProgram | null): string {
  if (!program) return "정보 없음";
  return getCompareOperationalText(
    getFirstCompareText(
      program.detail?.support_type,
      program.support_type,
      valueToCompareText(getCompareMetaValue(program, "training_type", "business_type", "target_group")),
      getEligibilityLabel(program)
    )
  );
}

function valueToCompareText(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) return String(value);
  if (typeof value === "string" && value.trim()) return value.trim();
  return null;
}

export function getCompareKeywords(program: CompareProgram | null): string[] {
  if (!program) return [];
  return [
    ...normalizeTextList(program.detail?.tech_stack),
    ...normalizeTextList(program.skills),
    ...normalizeTextList(program.detail?.tags),
    ...normalizeTextList(program.tags),
  ]
    .filter((item, index, items) => items.indexOf(item) === index)
    .slice(0, 8);
}

function normalizeIntroText(value: string): string {
  return value
    .replace(/\s+/g, "")
    .replace(/주식회사|\(주\)|㈜|[()（）]/gu, "")
    .toLowerCase();
}

function isInformativeIntroText(program: CompareProgram, value: unknown): value is string {
  if (typeof value !== "string") return false;

  const text = value.trim();
  if (!text || text === "정보 없음" || text === "데이터 미수집") return false;

  const normalized = normalizeIntroText(text);
  const organizationLabels = [
    program.provider,
    program.source,
    program.detail?.provider,
    program.detail?.organizer,
  ]
    .filter((item): item is string => Boolean(item?.trim()))
    .map(normalizeIntroText);

  if (organizationLabels.some((label) => label && normalized === label)) {
    return false;
  }

  const looksLikeOrganizationName = /학원|평생교육원|기관|센터|재단|협회|대학교|아카데미/u.test(text);
  if (looksLikeOrganizationName && text.length < 40 && !/[.。]|교육|훈련|과정|역량|실무|취업|창업|프로젝트|자격/u.test(text)) {
    return false;
  }

  return text.length >= 12 || /교육|훈련|과정|학습|역량|실무|취업|창업|프로젝트|자격|개발|데이터|마케팅/u.test(text);
}

export function getInformativeProgramSummary(program: CompareProgram | null): string | null {
  if (!program) return null;

  const candidates = [
    program.summary,
    program.detail?.description,
    program.description,
  ];
  return candidates.find((value) => isInformativeIntroText(program, value)) ?? null;
}

export function getInformativeProgramDescription(program: CompareProgram | null): string | null {
  if (!program) return null;

  const candidates = [program.detail?.description, program.description, program.summary];
  return candidates.find((value) => isInformativeIntroText(program, value)) ?? null;
}

export function hasCompareIntroContent(programs: Array<CompareProgram | null>): boolean {
  return programs.some(
    (program) =>
      Boolean(getInformativeProgramSummary(program)) ||
      Boolean(getInformativeProgramDescription(program))
  );
}
