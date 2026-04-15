export type TickerItem = {
  tone: "red" | "orange" | "amber" | "green";
  text: string;
};

export type DdayCard = {
  deadline: string;
  title: string;
  source: string;
  tone: "red" | "orange" | "amber";
  urgent?: boolean;
};

export type ProgramCard = {
  source: string;
  deadline: string;
  deadlineTone: "red" | "orange" | "amber" | "green";
  title: string;
  tags: string[];
  category: string;
  subsidy?: string;
  match: number;
  borderTone: "urgent" | "warm" | "calm" | "ad";
  ad?: boolean;
  primaryLabel: string;
};

export type CompareCard = {
  title: string;
  deadline: string;
  deadlineTone: "red" | "amber" | "muted";
  subsidy: string;
  duration: string;
  outcome: string;
  match: number;
  winner?: boolean;
};

export type FlowStep = {
  step: string;
  title: string;
  description: string;
  tone: "blue" | "amber" | "orange" | "green";
};

export const tickerItems: TickerItem[] = [
  { tone: "red", text: "D-1 · K-디지털 풀스택 개발자 과정 · HRD넷" },
  { tone: "orange", text: "D-3 · 청년 AI 데이터 인턴십 2기 · 고용24" },
  { tone: "amber", text: "D-5 · 내일배움카드 AI 자동화 실무 과정 · HRD넷" },
  { tone: "amber", text: "D-7 · UX/UI 디자이너 양성과정 · 서울시" },
  { tone: "green", text: "D-12 · 경영·스타트업 실무 과정 · K-Startup" },
];

export const heroCards: DdayCard[] = [
  {
    deadline: "D-1",
    title: "K-디지털 풀스택 개발자 과정",
    source: "HRD넷 · 서울",
    tone: "red",
    urgent: true,
  },
  {
    deadline: "D-3",
    title: "청년 AI 데이터 인턴십",
    source: "고용24 · 서울",
    tone: "orange",
  },
  {
    deadline: "D-7",
    title: "UX/UI 디자이너 양성과정",
    source: "서울시 · 마포구",
    tone: "amber",
  },
];

export const chipOptions = [
  "전체",
  "마감임박",
  "AI·데이터",
  "IT·개발",
  "디자인",
  "경영",
  "창업",
  "서울",
  "경기",
  "온라인",
  "국비100%",
];

export const programCards: ProgramCard[] = [
  {
    source: "HRD넷 · 서울 · 강남",
    deadline: "D-1",
    deadlineTone: "red",
    title: "K-디지털 풀스택 개발자 과정 6기",
    tags: ["6개월", "취업연계"],
    category: "IT·개발",
    subsidy: "국비 100%",
    match: 87,
    borderTone: "urgent",
    primaryLabel: "지원하기",
  },
  {
    source: "고용24 · 서울",
    deadline: "D-3",
    deadlineTone: "orange",
    title: "청년 AI 데이터 분석 인턴십 2기",
    tags: ["3개월"],
    category: "AI·데이터",
    subsidy: "월 200만원 지원",
    match: 72,
    borderTone: "warm",
    primaryLabel: "지원하기",
  },
  {
    source: "코드잇 스프린트 · 서울",
    deadline: "상시",
    deadlineTone: "green",
    title: "코드잇 스프린트 프론트엔드 6기",
    tags: ["5개월", "멘토링 포함"],
    category: "IT·개발",
    subsidy: "국비 80%",
    match: 65,
    borderTone: "ad",
    ad: true,
    primaryLabel: "자세히 보기",
  },
  {
    source: "서울시 · 온라인",
    deadline: "D-6",
    deadlineTone: "amber",
    title: "브랜드 디자이너 취업 연계 트랙",
    tags: ["포트폴리오", "온라인"],
    category: "디자인",
    subsidy: "국비 100%",
    match: 69,
    borderTone: "calm",
    primaryLabel: "지원하기",
  },
  {
    source: "K-Startup · 경기",
    deadline: "D-4",
    deadlineTone: "orange",
    title: "예비창업자 성장캠프 실전 과정",
    tags: ["8주", "멘토링"],
    category: "창업",
    subsidy: "국비 100%",
    match: 74,
    borderTone: "warm",
    primaryLabel: "지원하기",
  },
  {
    source: "고용24 · 하이브리드",
    deadline: "D-7",
    deadlineTone: "amber",
    title: "퍼포먼스 마케팅 취업 캠프",
    tags: ["12주", "실무 프로젝트"],
    category: "경영",
    subsidy: "국비 100%",
    match: 68,
    borderTone: "calm",
    primaryLabel: "지원하기",
  },
];

export const compareCards: CompareCard[] = [
  {
    title: "K-디지털 풀스택 개발자 과정",
    deadline: "D-1 · 내일 마감",
    deadlineTone: "red",
    subsidy: "100% 전액",
    duration: "6개월",
    outcome: "취업연계",
    match: 87,
    winner: true,
  },
  {
    title: "코드잇 스프린트 프론트엔드",
    deadline: "상시 모집",
    deadlineTone: "muted",
    subsidy: "80%",
    duration: "5개월",
    outcome: "멘토링 포함",
    match: 65,
  },
  {
    title: "패스트캠퍼스 데이터 부트캠프",
    deadline: "D-12",
    deadlineTone: "amber",
    subsidy: "70%",
    duration: "4개월",
    outcome: "기업 프로젝트",
    match: 71,
  },
];

export const flowSteps: FlowStep[] = [
  {
    step: "01",
    title: "정보 탐색",
    description: "국비 교육, 청년 인턴십, 취창업 지원 사업을 한 화면에서 탐색합니다.",
    tone: "blue",
  },
  {
    step: "02",
    title: "AI 맞춤 추천",
    description: "내 프로필과 관심 분야를 기반으로 관련도 높은 순서로 정렬합니다.",
    tone: "amber",
  },
  {
    step: "03",
    title: "서류 즉시 생성",
    description: "이력서와 포트폴리오 초안을 바로 생성해 제출 준비를 줄입니다.",
    tone: "orange",
  },
  {
    step: "04",
    title: "바로 지원",
    description: "마감 전 필요한 서류를 정리하고 바로 지원 흐름으로 연결합니다.",
    tone: "green",
  },
];

export const tickerLoop = [...tickerItems, ...tickerItems];

export const toneClassMap: Record<TickerItem["tone"], string> = {
  red: "bg-[rgba(255,255,255,0.28)]",
  orange: "bg-[rgba(255,255,255,0.22)]",
  amber: "bg-[rgba(255,255,255,0.18)]",
  green: "bg-[rgba(255,255,255,0.18)]",
};
