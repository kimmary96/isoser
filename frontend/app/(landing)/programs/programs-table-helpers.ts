import {
  formatProgramCostLabel,
  formatProgramScheduleLabel,
  getProgramTrainingModeLabel,
  getProgramSelectionKeywords,
  getProgramSupportBadge,
} from "@/lib/program-display";
import { deriveNcsMajorCategoryLabels } from "@/lib/ncs-categories";
import type { ProgramListRow } from "@/lib/types";

import { deadlineLabel, normalizeTextList } from "./program-utils";

const CATEGORY_DETAIL_LABELS: Record<string, string> = {
  "ncs-01": "사업관리",
  "ncs-02": "경영·회계·사무",
  "ncs-03": "금융·보험",
  "ncs-04": "교육·자연·사회과학",
  "ncs-05": "법률·경찰·소방·교도·국방",
  "ncs-06": "보건·의료",
  "ncs-07": "사회복지·종교",
  "ncs-08": "문화·예술·디자인·방송",
  "ncs-09": "운전·운송",
  "ncs-10": "영업판매",
  "ncs-11": "경비·청소",
  "ncs-12": "이용·숙박·여행·오락·스포츠",
  "ncs-13": "음식서비스",
  "ncs-14": "건설",
  "ncs-15": "기계",
  "ncs-16": "재료",
  "ncs-17": "화학·바이오",
  "ncs-18": "섬유·의복",
  "ncs-19": "전기·전자",
  "ncs-20": "정보통신",
  "ncs-21": "식품가공",
  "ncs-22": "인쇄·목재·가구·공예",
  "ncs-23": "환경·에너지·안전",
  "ncs-24": "농림어업",
  "web-development": "웹·백엔드",
  mobile: "모바일·프론트엔드",
  "data-ai": "데이터·AI",
  "cloud-security": "클라우드·보안",
  "iot-embedded-semiconductor": "임베디드·반도체",
  "game-blockchain": "게임·블록체인",
  "planning-marketing-other": "기획·마케팅",
  "design-3d": "디자인·3D",
  "project-career-startup": "창업·커리어",
};

const CATEGORY_KEYWORD_ALIASES: Record<string, string[]> = {
  정보통신: ["IT", "정보기술", "소프트웨어"],
  "문화·예술·디자인·방송": ["디자인"],
  "경영·회계·사무": ["경영"],
};

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

export function formatSchedule(program: ProgramListRow): string {
  return formatProgramScheduleLabel(program, { unknownLabel: "-" });
}

export function formatCost(program: ProgramListRow): string {
  return formatProgramCostLabel(program) || "-";
}

export function getSupportBadge(program: ProgramListRow): string | null {
  return getProgramSupportBadge(program);
}

export function formatMethodAndRegion(program: ProgramListRow): { method: string | null; region: string | null } {
  return {
    method: getProgramTrainingModeLabel(program),
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
  const ncsCategories = deriveNcsMajorCategoryLabels(program);
  if (ncsCategories.length) return ncsCategories;

  const derived = normalizeTextList(program.display_categories);
  if (derived.length) return derived.slice(0, 2);
  return [CATEGORY_DETAIL_LABELS[program.category_detail || ""], program.category, program.category_detail]
    .filter((value): value is string => Boolean(value?.trim()))
    .slice(0, 2);
}

export function extractSelectionKeywords(program: ProgramListRow): string[] {
  const categories = getDisplayCategories(program);
  const duplicateKeywords = new Set(
    categories.flatMap((category) => [category, ...(CATEGORY_KEYWORD_ALIASES[category] || [])])
  );
  return getProgramSelectionKeywords(program).filter((keyword) => !duplicateKeywords.has(keyword));
}
