export type TickerItem = {
  tone: "red" | "orange" | "amber" | "green";
  text: string;
};

export type TrustPoint = {
  title: string;
  description: string;
};

export type WorkspaceStage = {
  step: string;
  title: string;
  description: string;
  href: string;
  cta: string;
};

export type CompareCard = {
  title: string;
  fit: string;
  timeline: string;
  support: string;
  signal: string;
  tone: "ink" | "blue" | "fire";
};

export type JourneyStep = {
  step: string;
  title: string;
  description: string;
};

export const tickerItems: TickerItem[] = [
  { tone: "red", text: "D-1 · K-디지털 풀스택 개발자 과정 · HRD넷" },
  { tone: "orange", text: "D-3 · 청년 AI 데이터 인턴십 · 고용24" },
  { tone: "amber", text: "D-5 · 포트폴리오 디자인 트랙 · 서울시" },
  { tone: "amber", text: "D-7 · 퍼포먼스 마케팅 취업캠프 · 고용24" },
  { tone: "green", text: "신규 · 온라인 국비 과정 12건 업데이트" },
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

export const trustPoints: TrustPoint[] = [
  {
    title: "흩어진 공고를 한 흐름으로",
    description: "고용24, HRD, K-Startup, 지자체 공고를 같은 기준으로 읽을 수 있게 정리합니다.",
  },
  {
    title: "탐색에서 서류까지 연결",
    description: "프로그램 탐색만 끝나는 게 아니라, 로그인 후 이력서·자소서·매치 분석까지 이어집니다.",
  },
  {
    title: "대시보드와 같은 언어",
    description: "랜딩에서 본 프로그램 탐색 경험이 그대로 대시보드 워크스페이스로 이어지도록 설계했습니다.",
  },
];

export const workspaceStages: WorkspaceStage[] = [
  {
    step: "01",
    title: "지금 필요한 지원사업 찾기",
    description: "비로그인 상태에서도 마감 임박 공고, 카테고리, 지역 조건을 빠르게 훑습니다.",
    href: "/programs",
    cta: "프로그램 둘러보기",
  },
  {
    step: "02",
    title: "로그인 후 프로필 연결",
    description: "관심 분야와 활동 이력을 연결해 AI 추천이 단순 검색이 아니라 개인화 흐름이 되게 만듭니다.",
    href: "/login",
    cta: "무료로 시작하기",
  },
  {
    step: "03",
    title: "대시보드에서 바로 실행",
    description: "추천 캘린더, 문서 생성, 공고 매치 분석까지 같은 워크스페이스에서 이어서 수행합니다.",
    href: "/dashboard",
    cta: "대시보드 보기",
  },
];

export const compareCards: CompareCard[] = [
  {
    title: "빠른 취업 전환형",
    fit: "마감 임박 공고를 우선 보고 바로 지원하고 싶은 경우",
    timeline: "D-day, 모집 상태, 지원 링크를 한 번에 확인",
    support: "공고 탐색 → 비교 → 지원",
    signal: "즉시성 중심",
    tone: "fire",
  },
  {
    title: "탐색 + 개인화 추천형",
    fit: "관심 분야는 있지만 어떤 프로그램이 맞는지 판단이 필요한 경우",
    timeline: "프로필 연결 후 관련도 기준으로 정렬",
    support: "탐색 → 로그인 → 추천 캘린더",
    signal: "개인화 중심",
    tone: "blue",
  },
  {
    title: "서류 준비 동반형",
    fit: "좋은 프로그램을 찾은 뒤 이력서와 자기소개서까지 이어서 준비해야 하는 경우",
    timeline: "추천 결과를 문서 워크플로우와 연결",
    support: "추천 → 이력서/자소서 → 매치 분석",
    signal: "실행 중심",
    tone: "ink",
  },
];

export const journeySteps: JourneyStep[] = [
  {
    step: "A",
    title: "탐색",
    description: "지원 가능 공고를 공공기관별 원문 대신 공통된 구조로 확인합니다.",
  },
  {
    step: "B",
    title: "판단",
    description: "비교 화면과 관련도 정보로 지금 지원할 공고를 줄여갑니다.",
  },
  {
    step: "C",
    title: "준비",
    description: "로그인 후 프로필과 성과저장소를 연결해 서류 초안과 맞춤 추천을 받습니다.",
  },
  {
    step: "D",
    title: "실행",
    description: "대시보드에서 매치 분석과 문서 편집을 마치고 지원으로 넘어갑니다.",
  },
];

export const tickerLoop = [...tickerItems, ...tickerItems];

export const toneClassMap: Record<TickerItem["tone"], string> = {
  red: "bg-[rgba(255,255,255,0.28)]",
  orange: "bg-[rgba(255,255,255,0.22)]",
  amber: "bg-[rgba(255,255,255,0.18)]",
  green: "bg-[rgba(255,255,255,0.18)]",
};
