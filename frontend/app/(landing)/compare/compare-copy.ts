export const COMPARE_COPY = {
  metadata: {
    title: "훈련과정 비교 | 이소서",
    description:
      "최대 3개의 훈련과정을 한 화면에서 비교하고 일정, 비용, 지원 조건, 커리어 핏을 빠르게 검토할 수 있습니다.",
  },
  hero: {
    title: "훈련과정 비교",
    description:
      "최대 3개 과정을 나란히 놓고 일정, 비용, 지원 조건, 커리어 핏을 한 화면에서 비교하세요.",
    badges: [
      "현재 운영 데이터 기준",
      "미수집 항목은 따로 표시",
      "로그인 시 커리어 핏 계산",
    ],
  },
  legend: {
    title: "표기 기준",
    empty: "정보 없음: 현재 컬럼 값이 비어 있음",
    missing: "데이터 미수집: 원천별 운영 메타가 아직 수집되지 않음",
    fit: "커리어 핏은 로그인 후 내 이력과 활동을 기준으로 계산됩니다",
  },
  slot: {
    winnerBadge: "내 커리어와 가장 가까움",
    addTitle: "과정 추가",
    addDescription: "찜 목록 또는 검색에서 선택",
  },
  loginCta: {
    title: "내 이력과 비교하면 더 정확해져요",
    description:
      "로그인하면 찜한 과정, 활동, 희망 직무를 바탕으로 커리어 핏을 다시 계산합니다.",
    button: "내 커리어 핏 보기",
  },
  suggestions: {
    title: "같이 비교해볼 과정",
    description:
      "찜한 과정과 지금 비교 중인 과정에 가까운 모집중 후보를 먼저 보여줍니다.",
    error: "후보 과정을 불러올 수 없습니다.",
    empty: "지금 추가할 수 있는 모집중 과정이 없습니다.",
    fallbackReason: "모집중 후보",
    addButton: "+ 비교에 추가",
  },
  fit: {
    title: "커리어 핏",
    note: "내 이력·활동·과정 데이터 기준",
    rows: {
      stage: "커리어 핏 단계",
      keywords: "맞닿은 키워드",
      comment: "AI 코멘트 한스푼",
    },
    fallback: {
      empty: "정보 없음",
      login: "로그인 후 확인",
      loading: "계산 중",
      error: "불러오기 실패",
    },
    noKeywords: "키워드 없음",
  },
  errors: {
    careerFit: "커리어 핏 데이터를 불러오지 못했습니다.",
    personalizedCandidates: "내 이력 기준 후보를 불러오지 못했습니다.",
    candidates: "후보 과정을 불러오지 못했습니다.",
  },
  suggestionReasons: {
    bookmark: "찜한 과정",
    recommendation: "내 이력 기준",
    similar: "비교 항목과 유사",
    public: "모집중 공개 후보",
  },
  modal: {
    title: "과정 선택",
    description: (slotNumber: number) => `비교 슬롯 ${slotNumber}에 추가할 과정을 선택하세요.`,
    tabs: {
      bookmarks: "찜한 과정",
      search: "전체 검색",
    },
    bookmarks: {
      loading: "찜한 과정을 불러오는 중입니다...",
      loginTitle: "로그인하면 찜한 과정을 바로 불러올 수 있습니다",
      errorTitle: "찜한 과정을 불러오지 못했습니다",
      empty: "아직 찜한 과정이 없습니다.",
      retryDescription: "네트워크가 느리거나 로그인 세션 확인이 지연됐습니다.",
      searchButton: "전체 검색으로 찾기",
      retryButton: "다시 시도",
    },
    search: {
      placeholder: "과정명, 카테고리, 기관 검색...",
      error: "과정 검색 결과를 불러오지 못했습니다.",
    },
  },
} as const;
