export const DASHBOARD_COPY = {
  programs: {
    sectionTitle: "내 커리어 핏 추천",
    manageLink: "과정 탐색 >",
    empty: "아직 내 이력과 맞는 추천 과정이 없습니다",
    filteredEmpty: "해당 조건에 맞는 추천 과정이 없습니다",
    dateEmpty: "해당 날짜에 마감되는 과정이 없습니다",
    loadError: "커리어 핏 과정을 불러오지 못했습니다.",
    appliedNotice: (count: number) =>
      `캘린더에 담은 과정 ${count}건 · 카드의 "+ 담기"로 일정을 추가할 수 있습니다.`,
    fallbackCategory: "과정",
    applyButton: "+ 담기",
    appliedButton: "담김",
    calendarApply: "캘린더에 담기",
    calendarApplied: "캘린더에 담김",
  },
  bookmarks: {
    sectionTitle: "찜한 과정",
    viewAllLink: "비교하기 >",
    empty: "아직 찜한 과정이 없습니다",
    loadError: "찜한 과정을 불러오지 못했습니다.",
    cardLabel: "찜한 과정",
  },
  calendar: {
    title: "커리어 핏 일정",
    description:
      "내 이력과 가까운 과정의 마감일을 한 번에 보고 바로 지원하거나 이력서 작성으로 이어갈 수 있습니다.",
    empty: "아직 보여줄 일정이 없습니다. 내 이력을 채우면 커리어 핏 일정이 보입니다.",
    profileButton: "내 이력 채우기",
    reasonFallback: "커리어 핏 근거 없음",
    scoreLabel: "커리어 핏",
    deadlineLabel: "마감일",
    applyButton: "지원하기",
    resumeButton: "이력서 바로 만들기",
    loadError: "커리어 핏 일정을 불러오지 못했습니다.",
  },
} as const;
