export const PROGRAM_CATEGORIES = [
  "전체",
  "개발",
  "데이터/DB",
  "AI/머신러닝",
  "보안/네트워크",
  "클라우드",
  "디자인/UX",
  "영상/미디어",
  "마케팅",
  "기획/PM",
  "경영/회계",
  "외국어",
  "요리/제과",
  "미용/뷰티",
  "건축/인테리어",
  "전기/전자",
  "의료/복지",
] as const;

export type ProgramCategory = (typeof PROGRAM_CATEGORIES)[number];
