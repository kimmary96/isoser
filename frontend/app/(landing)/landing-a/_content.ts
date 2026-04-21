export type TickerItem = {
  tone: "red" | "orange" | "amber" | "green";
  text: string;
};

export type TrustPoint = {
  title: string;
  description: string;
};

export type ComparisonColumn = {
  title: string;
  items: string[];
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

export type FeaturePreview = {
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
};

export type AccuracyFactor = {
  title: string;
  description: string;
};

export type KpiSkeleton = {
  label: string;
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
    title: "마감 임박 공고",
    description: "D-Day와 모집 상태를 먼저 확인하고 지원 우선순위를 잡습니다.",
  },
  {
    title: "추천 연결 준비",
    description: "탐색한 프로그램은 로그인 후 추천 캘린더와 지원 준비 흐름으로 이어집니다.",
  },
  {
    title: "지원 준비까지",
    description: "이력과 활동을 등록하면 공고에 맞춘 문서 작성 흐름을 바로 시작할 수 있습니다.",
  },
];

export const comparisonColumns: ComparisonColumn[] = [
  {
    title: "겪고 있는 문제",
    items: ["여기저기 흩어진 프로그램 정보", "내 상황과 안 맞는 추천", "지원 때마다 문서 다시 작성"],
  },
  {
    title: "이소서 해결 방식",
    items: ["한곳에 모은 공공 지원 프로그램", "이력 기반 개인화 추천", "같은 흐름에서 지원 문서 생성"],
  },
];

export const workspaceStages: WorkspaceStage[] = [
  {
    step: "01",
    title: "프로그램 탐색",
    description: "마감, 지역, 관심 분야를 기준으로 지원 가능한 공고를 확인합니다.",
    href: "/programs",
    cta: "프로그램 둘러보기",
  },
  {
    step: "02",
    title: "이력/활동 등록",
    description: "관심 분야와 활동 이력을 연결해 추천 기준을 만듭니다.",
    href: "/login",
    cta: "무료로 시작하기",
  },
  {
    step: "03",
    title: "맞춤 추천",
    description: "프로필과 일정에 맞는 프로그램을 추천 캘린더로 정리합니다.",
    href: "/dashboard",
    cta: "대시보드 보기",
  },
  {
    step: "04",
    title: "지원 문서 생성",
    description: "선택한 공고에 맞춰 이력서와 포트폴리오 초안을 준비합니다.",
    href: "/dashboard",
    cta: "문서 준비",
  },
  {
    step: "05",
    title: "참여 성과 저장",
    description: "활동 결과와 STAR 경험을 성과저장소에 남깁니다.",
    href: "/dashboard",
    cta: "성과 저장",
  },
  {
    step: "06",
    title: "다음 추천/취업 준비 재사용",
    description: "쌓인 이력 데이터를 다음 추천과 면접 준비에 다시 씁니다.",
    href: "/dashboard",
    cta: "다시 활용",
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
    step: "01",
    title: "프로필",
    description: "학력, 경력, 보유 역량을 추천의 기본 신호로 사용합니다.",
  },
  {
    step: "02",
    title: "활동",
    description: "프로젝트, 교육, 수상, 경험 기록을 공고 적합도에 반영합니다.",
  },
  {
    step: "03",
    title: "관심 분야",
    description: "직무와 기술 관심사를 기준으로 프로그램 후보를 좁힙니다.",
  },
  {
    step: "04",
    title: "지역·상황",
    description: "거주 지역, 온라인 가능 여부, 일정 조건을 함께 계산합니다.",
  },
];

export const featurePreviews: FeaturePreview[] = [
  {
    title: "프로그램 추천 캘린더",
    description: "마감 일정과 내게 맞는 추천을 캘린더에서 함께 봅니다.",
    imageSrc: "/landing-a/program-recommendation-calendar.svg",
    imageAlt: "프로그램 추천 캘린더 화면 미리보기",
  },
  {
    title: "성과저장소 STAR 코치",
    description: "활동 경험을 STAR 구조로 정리해 지원 문서에 재사용합니다.",
    imageSrc: "/landing-a/star-coach.svg",
    imageAlt: "성과저장소 STAR 코치 화면 미리보기",
  },
  {
    title: "이력서/포트폴리오 PDF",
    description: "등록한 이력 데이터를 공고에 맞춘 PDF 문서로 준비합니다.",
    imageSrc: "/landing-a/resume-portfolio-pdf.svg",
    imageAlt: "이력서와 포트폴리오 PDF 화면 미리보기",
  },
  {
    title: "공고 매칭 점수",
    description: "공고 요구사항과 내 이력의 맞는 지점을 점수로 확인합니다.",
    imageSrc: "/landing-a/job-matching-score.svg",
    imageAlt: "공고 매칭 점수 화면 미리보기",
  },
];

export const accuracyFactors: AccuracyFactor[] = [
  {
    title: "프로필",
    description: "기본 이력과 희망 직무",
  },
  {
    title: "활동",
    description: "프로젝트와 성과 기록",
  },
  {
    title: "관심 분야",
    description: "기술 스택과 학습 목표",
  },
  {
    title: "지역·상황",
    description: "거주지, 일정, 참여 방식",
  },
];

export const kpiSkeletons: KpiSkeleton[] = [
  { label: "누적 추천 프로그램 조회 수" },
  { label: "이력 기반 추천 생성 수" },
  { label: "프로그램 지원용 문서 생성 수" },
  { label: "프로그램 참여 후기 수" },
  { label: "프로그램 이후 취업/면접 후기 수" },
];

export const tickerLoop = [...tickerItems, ...tickerItems];

export const toneClassMap: Record<TickerItem["tone"], string> = {
  red: "bg-[rgba(255,255,255,0.28)]",
  orange: "bg-[rgba(255,255,255,0.22)]",
  amber: "bg-[rgba(255,255,255,0.18)]",
  green: "bg-[rgba(255,255,255,0.18)]",
};
