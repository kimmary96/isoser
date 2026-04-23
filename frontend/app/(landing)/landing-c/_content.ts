import { PROGRAM_FILTER_CHIPS } from "../../../lib/program-filters";

export const chips = PROGRAM_FILTER_CHIPS;

export const OPPORTUNITY_FEED_SIZE = 6;

export const SEOUL_DISTRICTS = [
  "강남",
  "강동",
  "강북",
  "강서",
  "관악",
  "광진",
  "구로",
  "금천",
  "노원",
  "도봉",
  "동대문",
  "동작",
  "마포",
  "서대문",
  "서초",
  "성동",
  "성북",
  "송파",
  "양천",
  "영등포",
  "용산",
  "은평",
  "종로",
  "중구",
  "중랑",
] as const;

export const workflowCards = [
  {
    title: "PDF에서 바로 시작",
    body: "기존 이력서 PDF를 올리면 이름, 연락처, 경력, 프로젝트를 한 번에 정리합니다.",
    preview: "pdf",
  },
  {
    title: "성과 저장소로 자산화",
    body: "회사경력, 프로젝트, 대외활동을 흩어지지 않게 보관하고 필요할 때 다시 조합합니다.",
    preview: "activity",
  },
  {
    title: "공고 매칭 분석",
    body: "지원 공고와 내 경험을 비교해 강점, 부족 키워드, 추천 활동을 바로 확인합니다.",
    preview: "match",
  },
  {
    title: "문서 저장과 PDF 출력",
    body: "선택한 활동으로 이력서를 만들고 문서 저장소에서 다시 꺼내 PDF로 내보냅니다.",
    preview: "resume",
  },
] as const;

export const circularFlowSteps = [
  {
    step: "01",
    title: "프로그램 탐색",
    description: "마감, 지역, 관심 분야를 기준으로 지원 가능한 공고를 확인합니다.",
  },
  {
    step: "02",
    title: "이력/활동 등록",
    description: "관심 분야와 활동 이력을 연결해 추천 기준을 만듭니다.",
  },
  {
    step: "03",
    title: "맞춤 추천",
    description: "프로필과 일정에 맞는 프로그램을 추천 캘린더로 정리합니다.",
  },
  {
    step: "04",
    title: "지원 문서 생성",
    description: "선택한 공고에 맞춰 이력서와 포트폴리오 초안을 준비합니다.",
  },
  {
    step: "05",
    title: "참여 성과 저장",
    description: "활동 결과와 STAR 경험을 성과저장소에 남깁니다.",
  },
  {
    step: "06",
    title: "다음 추천/취업 준비 재사용",
    description: "쌓인 이력 데이터를 다음 추천과 면접 준비에 다시 씁니다.",
  },
] as const;

export const liveBoardSources = [
  {
    label: "고용24",
    matches: ["고용24", "work24"],
  },
  {
    label: "창업진흥원",
    matches: ["창업진흥원", "k-startup", "kstartup"],
  },
  {
    label: "새싹",
    matches: ["새싹", "sesac", "seoul software academy"],
  },
] as const;
