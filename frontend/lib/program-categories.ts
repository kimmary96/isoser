export const PROGRAM_CATEGORIES = [
  "전체",
  "AI",
  "IT",
  "디자인",
  "경영",
  "창업",
  "기타",
] as const;

export type ProgramCategory = (typeof PROGRAM_CATEGORIES)[number];
