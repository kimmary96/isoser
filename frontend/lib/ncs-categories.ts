import type { ProgramCardSummary } from "./types";

const NCS_MAJOR_LABELS = {
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
} as const;

const NCS_LABEL_SET = new Set<string>(Object.values(NCS_MAJOR_LABELS));

const CATEGORY_TO_NCS_LABEL: Record<string, string> = {
  IT: "정보통신",
  AI: "정보통신",
  경영: "경영·회계·사무",
  디자인: "문화·예술·디자인·방송",
  창업: "사업관리",
};

const TEXT_RULES: readonly [string, readonly string[]][] = [
  ["사업관리", ["사업관리", "프로젝트관리", "창업", "스타트업", "사업계획"]],
  ["경영·회계·사무", ["경영", "회계", "사무", "마케팅", "홍보", "인사", "총무", "재무", "세무", "전산회계", "전산세무", "컴활", "컴퓨터활용능력", "엑셀", "엑세스"]],
  ["금융·보험", ["금융", "보험", "투자", "자산관리"]],
  ["보건·의료", ["보건", "의료", "간호", "병원"]],
  ["사회복지·종교", ["사회복지", "요양보호"]],
  ["교육·자연·사회과학", ["교육", "강사", "교수설계"]],
  ["문화·예술·디자인·방송", ["디자인", "영상", "방송", "문화", "예술", "3d", "그래픽", "스케치업", "일러스트", "프리미어", "포토샵", "gtq", "ux", "ui"]],
  ["운전·운송", ["운전", "운송", "물류운송", "지게차", "굴착기", "중장비"]],
  ["영업판매", ["영업", "판매", "유통", "무역", "쇼핑몰", "커머스", "카페24"]],
  ["이용·숙박·여행·오락·스포츠", ["숙박", "여행", "오락", "스포츠", "레저", "관광", "미용", "애견미용", "반려견스타일리스트"]],
  ["음식서비스", ["조리", "바리스타", "제과", "제빵"]],
  ["건설", ["건설", "건축", "토목", "조경", "타일시공", "시공", "인테리어"]],
  ["기계", ["기계", "자동차", "기계설계"]],
  ["전기·전자", ["전기", "전자", "반도체", "회로", "fpga", "soc", "verilog", "rtl"]],
  ["정보통신", ["정보통신", "응용sw", "소프트웨어", "정보기술", "itq", "it", "웹개발", "백엔드", "프론트엔드", "모바일", "빅데이터", "데이터", "인공지능", "ai", "클라우드", "정보보안", "네트워크", "게임", "블록체인"]],
  ["환경·에너지·안전", ["환경", "에너지", "안전"]],
  ["농림어업", ["농림", "어업", "농업", "축산", "수산"]],
];

type NcsCategoryProgram = Pick<ProgramCardSummary, "category" | "category_detail" | "display_categories"> &
  Partial<Pick<ProgramCardSummary, "title" | "summary" | "description" | "skills" | "tags">>;

function normalizeTextList(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) return value.filter((item) => typeof item === "string" && item.trim());
  if (typeof value === "string" && value.trim()) {
    return value.split(",").map((item) => item.trim()).filter(Boolean);
  }
  return [];
}

function dedupe(values: string[], limit = 2): string[] {
  const seen = new Set<string>();
  const items: string[] = [];
  for (const value of values) {
    const key = value.replace(/\s+/g, "").toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    items.push(value);
    if (items.length >= limit) break;
  }
  return items;
}

export function deriveNcsMajorCategoryLabels(
  program: NcsCategoryProgram
): string[] {
  const fromExisting = normalizeTextList(program.display_categories).filter((value) => NCS_LABEL_SET.has(value));
  if (fromExisting.length) return dedupe(fromExisting);

  const categoryDetail = String(program.category_detail || "").trim();
  const byId = NCS_MAJOR_LABELS[categoryDetail as keyof typeof NCS_MAJOR_LABELS];
  if (byId) return [byId];

  const byCategory = CATEGORY_TO_NCS_LABEL[String(program.category || "").trim()];
  if (byCategory) return [byCategory];

  const primaryText = [
    program.title,
    program.category,
    program.category_detail,
    ...normalizeTextList(program.skills),
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ")
    .toLowerCase();
  const primaryMatches = TEXT_RULES
    .filter(([, aliases]) => aliases.some((alias) => primaryText.includes(alias.toLowerCase())))
    .map(([label]) => label);
  if (primaryMatches.length) return dedupe(primaryMatches);

  const text = [
    program.title,
    program.summary,
    program.description,
    ...normalizeTextList(program.skills),
    ...normalizeTextList(program.tags),
  ]
    .filter((value): value is string => Boolean(value?.trim()))
    .join(" ")
    .toLowerCase();

  const matches = TEXT_RULES
    .filter(([, aliases]) => aliases.some((alias) => text.includes(alias.toLowerCase())))
    .map(([label]) => label);
  return dedupe(matches);
}
