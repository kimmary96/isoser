export type TickerItem = {
  tone: "red" | "orange" | "amber" | "green";
  text: string;
};

export type WorkspaceStage = {
  step: string;
  title: string;
  description: string;
  href: string;
  cta: string;
};

export type FeaturePreview = {
  title: string;
  description: string;
  imageSrc: string;
  imageAlt: string;
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

export const tickerLoop = [...tickerItems, ...tickerItems];

export const toneClassMap: Record<TickerItem["tone"], string> = {
  red: "bg-[rgba(255,255,255,0.28)]",
  orange: "bg-[rgba(255,255,255,0.22)]",
  amber: "bg-[rgba(255,255,255,0.18)]",
  green: "bg-[rgba(255,255,255,0.18)]",
};
