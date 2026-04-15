export type QuizAnswers = {
  situation: string;
  mode: string;
  interest: string;
  directInterest: string;
};

export type Option = {
  label: string;
  subtitle: string;
  icon: string;
};

export type ProgramPreview = {
  title: string;
  meta: string;
  deadline: string;
  tone: "red" | "orange" | "amber";
};

export const situationOptions: Option[] = [
  { label: "취업 준비", subtitle: "처음 취업 도전", icon: "📋" },
  { label: "이직", subtitle: "현재 재직 중", icon: "🔄" },
  { label: "재취업", subtitle: "경력 공백 있음", icon: "🌱" },
  { label: "창업", subtitle: "내 사업 시작", icon: "🚀" },
];

export const modeOptions: Option[] = [
  { label: "온라인", subtitle: "장소 자유", icon: "💻" },
  { label: "오프라인", subtitle: "집중 환경", icon: "🏫" },
  { label: "상관없음", subtitle: "좋은 거면 OK", icon: "🔀" },
];

export const interestOptions: Option[] = [
  { label: "AI·데이터", subtitle: "분석, 개발, ML", icon: "🤖" },
  { label: "IT·개발", subtitle: "웹, 앱, 백엔드", icon: "💻" },
  { label: "디자인", subtitle: "UX/UI, 그래픽", icon: "🎨" },
  { label: "경영·마케팅", subtitle: "기획, 마케팅", icon: "📈" },
];

export const resultCounts: Record<string, number> = {
  "AI·데이터": 23,
  "IT·개발": 31,
  디자인: 18,
  "경영·마케팅": 27,
};

export const previewPrograms: Record<string, ProgramPreview[]> = {
  "AI·데이터": [
    {
      title: "청년 AI 데이터 분석 인턴십 2기",
      meta: "고용24 · 온라인 · 월 200만원 · 3개월",
      deadline: "D-3",
      tone: "orange",
    },
    {
      title: "K-디지털 AI 엔지니어 부트캠프",
      meta: "HRD넷 · 강남구 · 국비 100% · 6개월",
      deadline: "D-1",
      tone: "red",
    },
    {
      title: "내일배움카드 AI 자동화 실무 과정",
      meta: "서울시 · 온라인 · 국비 80% · 2개월",
      deadline: "D-7",
      tone: "amber",
    },
    {
      title: "기업연계 데이터 시각화 프로젝트랩",
      meta: "K-디지털 · 하이브리드 · 4개월",
      deadline: "D-12",
      tone: "amber",
    },
  ],
  "IT·개발": [
    {
      title: "K-디지털 풀스택 개발자 과정 6기",
      meta: "HRD넷 · 강남구 · 국비 100% · 6개월",
      deadline: "D-1",
      tone: "red",
    },
    {
      title: "프론트엔드 실무 집중 부트캠프",
      meta: "고용24 · 온라인 · 포트폴리오 코칭 포함",
      deadline: "D-4",
      tone: "orange",
    },
    {
      title: "백엔드 취업 연계 프로젝트 트랙",
      meta: "서울시 · 오프라인 · 5개월",
      deadline: "D-8",
      tone: "amber",
    },
    {
      title: "앱 서비스 개발 취업캠프",
      meta: "K-디지털 · 하이브리드 · 4개월",
      deadline: "D-11",
      tone: "amber",
    },
  ],
  디자인: [
    {
      title: "UX/UI 실무 포트폴리오 부트캠프",
      meta: "서울시 · 성수 · 국비 100% · 4개월",
      deadline: "D-2",
      tone: "red",
    },
    {
      title: "브랜드 디자이너 취업 연계 트랙",
      meta: "고용24 · 온라인 · 3개월",
      deadline: "D-5",
      tone: "orange",
    },
    {
      title: "프로덕트 디자이너 양성과정",
      meta: "HRD넷 · 오프라인 · 5개월",
      deadline: "D-9",
      tone: "amber",
    },
    {
      title: "디자인 시스템 구축 워크숍",
      meta: "민간위탁 · 하이브리드 · 6주",
      deadline: "D-13",
      tone: "amber",
    },
  ],
  "경영·마케팅": [
    {
      title: "퍼포먼스 마케팅 취업 캠프",
      meta: "고용24 · 온라인 · 3개월",
      deadline: "D-2",
      tone: "red",
    },
    {
      title: "브랜드 전략 실무 트랙",
      meta: "서울시 · 오프라인 · 4개월",
      deadline: "D-6",
      tone: "orange",
    },
    {
      title: "CRM·그로스 마케팅 집중과정",
      meta: "K-디지털 · 하이브리드 · 10주",
      deadline: "D-10",
      tone: "amber",
    },
    {
      title: "콘텐츠 마케터 포트폴리오 랩",
      meta: "민간위탁 · 온라인 · 8주",
      deadline: "D-14",
      tone: "amber",
    },
  ],
};

export const urgencyChips = [
  "D-1 · K-디지털 풀스택",
  "D-3 · 청년 AI 인턴십",
  "D-5 · 내일배움카드 AI",
  "D-7 · UX/UI 양성과정",
];

export const featureCards = [
  {
    icon: "🔍",
    title: "프로그램 탐색",
    description: "847개 국가 지원 프로그램을 마감·지역·대상 조건으로 빠르게 추립니다.",
  },
  {
    icon: "⚖️",
    title: "부트캠프 비교",
    description: "최대 3개 과정을 나란히 두고 커리큘럼과 지원 조건을 확인합니다.",
  },
  {
    icon: "📄",
    title: "이력서 즉시 생성",
    description: "관심 프로그램에 맞춰 AI가 지원용 이력서 초안을 바로 정리합니다.",
  },
  {
    icon: "📅",
    title: "AI 취업 캘린더",
    description: "마감일과 준비 일정을 자동으로 정리해 놓치지 않게 돕습니다.",
  },
];

export const landingStats = [
  { value: "847개", label: "수집된 프로그램" },
  { value: "134곳", label: "우수훈련기관" },
  { value: "매일", label: "실시간 업데이트" },
];

export const initialAnswers: QuizAnswers = {
  situation: "",
  mode: "",
  interest: "",
  directInterest: "",
};

export function buildFallbackPrograms(interest: string): ProgramPreview[] {
  return [
    {
      title: `${interest} 맞춤 탐색 과정 A`,
      meta: "고용24 · 온라인 · 정적 미리보기 데이터",
      deadline: "D-4",
      tone: "orange",
    },
    {
      title: `${interest} 맞춤 탐색 과정 B`,
      meta: "HRD넷 · 오프라인 · 정적 미리보기 데이터",
      deadline: "D-6",
      tone: "orange",
    },
    {
      title: `${interest} 맞춤 탐색 과정 C`,
      meta: "서울시 · 하이브리드 · 정적 미리보기 데이터",
      deadline: "D-10",
      tone: "amber",
    },
    {
      title: `${interest} 맞춤 탐색 과정 D`,
      meta: "민간위탁 · 온라인 · 정적 미리보기 데이터",
      deadline: "D-13",
      tone: "amber",
    },
  ];
}
