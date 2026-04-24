import type {
  Activity,
  CoachFeedbackResponse,
  CoachMessage,
  CoverLetter,
  DashboardBookmarksResponse,
  DashboardCalendarSelectionsResponse,
  ProgramCompareSearchResponse,
  DashboardRecommendCalendarResponse,
  DashboardRecommendedProgramsResponse,
  Profile,
  ProgramCompareRelevanceResponse,
  ProgramSort,
  Resume,
  ActivityDetailResponse,
  ActivityListResponse,
  ActivityMutationResponse,
  CoverLetterDetailResponse,
  CoverLetterListResponse,
  CoverLetterMutationResponse,
  DashboardMeResponse,
  DashboardProfileResponse,
  DocumentsResponse,
  MatchDashboardResponse,
  ResumeBuilderResponse,
  ResumeExportResponse,
  SavedPortfolio,
  SavedMatchAnalysis,
} from "@/lib/types";

type OnboardingPayload = {
  profile: {
    name: string;
    email: string;
    phone: string;
    bio?: string;
    education: string;
    career?: string[];
    education_history?: string[];
    awards?: string[];
    certifications?: string[];
    languages?: string[];
    skills?: string[];
    self_intro?: string;
  };
  activities: Array<{
    type: Activity["type"];
    title: string;
    organization?: string | null;
    team_size?: number | null;
    team_composition?: string | null;
    my_role?: string | null;
    contributions?: string[];
    period: string;
    role: string;
    skills: string[];
    description: string;
  }>;
};

async function handleResponse<T>(
  response: Response,
  fallbackMessage: string
): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message = errorData?.error || errorData?.detail || fallbackMessage;
    const code = errorData?.code ? ` [${errorData.code}]` : "";
    throw new Error(`${message}${code}`);
  }

  return response.json() as Promise<T>;
}

async function requestAppJson<T>(
  path: string,
  init: RequestInit,
  fallbackMessage: string
): Promise<T> {
  const response = await fetch(path, init);
  return handleResponse<T>(response, fallbackMessage);
}

export async function getDashboardProfile(): Promise<DashboardProfileResponse> {
  return requestAppJson<DashboardProfileResponse>(
    "/api/dashboard/profile",
    { method: "GET" },
    "프로필 데이터를 불러오지 못했습니다."
  );
}

export async function getDashboardMe(): Promise<DashboardMeResponse> {
  return requestAppJson<DashboardMeResponse>(
    "/api/dashboard/me",
    { method: "GET" },
    "사용자 정보를 불러오지 못했습니다."
  );
}

export async function signOutDashboard(): Promise<{ ok: true }> {
  return requestAppJson<{ ok: true }>(
    "/api/auth/signout",
    { method: "POST" },
    "로그아웃에 실패했습니다."
  );
}

export async function saveOnboardingData(payload: OnboardingPayload): Promise<{ ok: true }> {
  return requestAppJson<{ ok: true }>(
    "/api/onboarding",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "온보딩 저장에 실패했습니다."
  );
}

export interface RecommendProgramsParams {
  category?: string;
  region?: string;
  forceRefresh?: boolean;
}

export async function getRecommendedPrograms(
  params?: RecommendProgramsParams
): Promise<DashboardRecommendedProgramsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.category) searchParams.set("category", params.category);
  if (params?.region) searchParams.set("region", params.region);
  if (params?.forceRefresh) searchParams.set("force_refresh", "true");

  const query = searchParams.toString();
  const url = `/api/dashboard/recommended-programs${query ? `?${query}` : ""}`;

  return requestAppJson<DashboardRecommendedProgramsResponse>(
    url,
    { method: "GET" },
    "추천 프로그램을 불러오지 못했습니다."
  );
}

export async function invalidateRecommendCache(): Promise<void> {
  try {
    await getRecommendedPrograms({ forceRefresh: true });
  } catch {
    // Ignore cache refresh failures so the dashboard can recover on next entry.
  }
}

export async function getRecommendCalendar(
  params?: RecommendProgramsParams
): Promise<DashboardRecommendCalendarResponse> {
  const searchParams = new URLSearchParams();
  if (params?.category) searchParams.set("category", params.category);
  if (params?.region) searchParams.set("region", params.region);
  if (params?.forceRefresh) searchParams.set("force_refresh", "true");

  const query = searchParams.toString();
  const url = `/api/dashboard/recommend-calendar${query ? `?${query}` : ""}`;

  return requestAppJson<DashboardRecommendCalendarResponse>(
    url,
    { method: "GET" },
    "캘린더 추천 프로그램을 불러오지 못했습니다."
  );
}

export async function getRecommendedCalendar(
  params?: RecommendProgramsParams
): Promise<DashboardRecommendCalendarResponse> {
  return getRecommendCalendar(params);
}

export async function getCalendarSelections(): Promise<DashboardCalendarSelectionsResponse> {
  return requestAppJson<DashboardCalendarSelectionsResponse>(
    "/api/dashboard/calendar-selections",
    { method: "GET" },
    "캘린더 적용 일정을 불러오지 못했습니다."
  );
}

export async function saveCalendarSelections(
  programIds: string[]
): Promise<{ programIds: string[] }> {
  return requestAppJson<{ programIds: string[] }>(
    "/api/dashboard/calendar-selections",
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ programIds }),
    },
    "캘린더 적용 일정 저장에 실패했습니다."
  );
}

export async function getProgramCompareRelevance(
  programIds: string[]
): Promise<ProgramCompareRelevanceResponse> {
  return requestAppJson<ProgramCompareRelevanceResponse>(
    "/api/programs/compare-relevance",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ programIds }),
    },
    "관련도 비교 데이터를 불러오지 못했습니다."
  );
}

export async function searchComparePrograms(params?: {
  q?: string;
  limit?: number;
  sort?: ProgramSort;
  recruitingOnly?: boolean;
}): Promise<ProgramCompareSearchResponse> {
  const searchParams = new URLSearchParams();
  if (params?.q) searchParams.set("q", params.q);
  if (typeof params?.limit === "number") searchParams.set("limit", String(params.limit));
  if (params?.sort) searchParams.set("sort", params.sort);
  if (params?.recruitingOnly) searchParams.set("recruiting_only", "true");

  const query = searchParams.toString();
  const url = `/api/programs/compare-search${query ? `?${query}` : ""}`;

  return requestAppJson<ProgramCompareSearchResponse>(
    url,
    { method: "GET" },
    "프로그램 검색 결과를 불러오지 못했습니다."
  );
}

export async function trackProgramDetailView(programId: string): Promise<{ ok: true }> {
  return requestAppJson<{ ok: true }>(
    `/api/programs/${encodeURIComponent(programId)}/detail-view`,
    { method: "POST", keepalive: true },
    "프로그램 상세 진입 기록에 실패했습니다."
  );
}

export async function getDashboardBookmarks(): Promise<DashboardBookmarksResponse> {
  return requestAppJson<DashboardBookmarksResponse>(
    "/api/dashboard/bookmarks",
    { method: "GET" },
    "찜한 프로그램을 불러오지 못했습니다."
  );
}

export async function updateDashboardProfileSection(
  patch: Partial<Profile>
): Promise<{ profile: Profile }> {
  return requestAppJson<{ profile: Profile }>(
    "/api/dashboard/profile",
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    },
    "프로필 저장에 실패했습니다."
  );
}

export async function saveDashboardProfile(
  payload: FormData
): Promise<{ profile: Profile }> {
  return requestAppJson<{ profile: Profile }>(
    "/api/dashboard/profile",
    {
      method: "PUT",
      body: payload,
    },
    "프로필 저장에 실패했습니다."
  );
}

export async function getResumeBuilderData(): Promise<ResumeBuilderResponse> {
  return requestAppJson<ResumeBuilderResponse>(
    "/api/dashboard/resume",
    { method: "GET" },
    "이력서 데이터를 불러오지 못했습니다."
  );
}

export async function getResumeExportData(
  resumeId?: string | null
): Promise<ResumeExportResponse> {
  const query = resumeId ? `?resumeId=${encodeURIComponent(resumeId)}` : "";
  return requestAppJson<ResumeExportResponse>(
    `/api/dashboard/resume-export${query}`,
    { method: "GET" },
    "PDF 데이터 로딩에 실패했습니다."
  );
}

export async function createResumeDocument(payload: {
  title: string;
  target_job: string | null;
  template_id: string;
  selected_activity_ids: string[];
}): Promise<{ id: string }> {
  return requestAppJson<{ id: string }>(
    "/api/dashboard/resume",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "이력서 저장에 실패했습니다."
  );
}

export async function getDocuments(): Promise<{ documents: Resume[] }> {
  return requestAppJson<DocumentsResponse>(
    "/api/dashboard/documents",
    { method: "GET" },
    "문서 목록을 불러오지 못했습니다."
  );
}

export async function listSavedPortfolios(): Promise<{ portfolios: SavedPortfolio[] }> {
  return requestAppJson<{ portfolios: SavedPortfolio[] }>(
    "/api/dashboard/portfolios",
    { method: "GET" },
    "포트폴리오 목록을 불러오지 못했습니다."
  );
}

export async function savePortfolioDocument(payload: {
  title: string;
  sourceActivityId: string;
  portfolio: NonNullable<SavedPortfolio["portfolio"]>;
}): Promise<{ id: string }> {
  return requestAppJson<{ id: string }>(
    "/api/dashboard/portfolios",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "포트폴리오 저장에 실패했습니다."
  );
}

export async function listCoverLetters(): Promise<{ coverLetters: CoverLetter[] }> {
  return requestAppJson<CoverLetterListResponse>(
    "/api/dashboard/cover-letters",
    { method: "GET" },
    "자기소개서 목록을 불러오지 못했습니다."
  );
}

export async function getCoverLetterDetail(
  id: string
): Promise<CoverLetterDetailResponse> {
  return requestAppJson<CoverLetterDetailResponse>(
    `/api/dashboard/cover-letters/${encodeURIComponent(id)}`,
    { method: "GET" },
    "자기소개서를 불러오지 못했습니다."
  );
}

export async function createCoverLetter(payload: {
  title: string;
  company_name: string | null;
  job_title: string | null;
  prompt_question: string;
  content: string;
  qa_items: Array<{ question: string; answer: string }>;
  tags: string[];
}): Promise<CoverLetterMutationResponse> {
  return requestAppJson<CoverLetterMutationResponse>(
    "/api/dashboard/cover-letters",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "자기소개서 저장에 실패했습니다."
  );
}

export async function updateCoverLetter(
  id: string,
  payload: {
    title: string;
    company_name: string | null;
    job_title: string | null;
    prompt_question: string;
    content: string;
    qa_items: Array<{ question: string; answer: string }>;
    tags: string[];
  }
): Promise<CoverLetterMutationResponse> {
  return requestAppJson<CoverLetterMutationResponse>(
    `/api/dashboard/cover-letters/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "자기소개서 저장에 실패했습니다."
  );
}

export async function deleteCoverLetter(id: string): Promise<{ id: string }> {
  return requestAppJson<{ id: string }>(
    `/api/dashboard/cover-letters/${encodeURIComponent(id)}`,
    { method: "DELETE" },
    "자기소개서 삭제에 실패했습니다."
  );
}

export async function requestCoverLetterCoaching(payload: {
  message: string;
  session_id?: string;
  activity_description: string;
  job_title: string;
  section_type: "요약";
  history: CoachMessage[];
}): Promise<CoachFeedbackResponse> {
  return requestAppJson<CoachFeedbackResponse>(
    "/api/dashboard/cover-letters/coach",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "AI 코칭 요청에 실패했습니다."
  );
}

export async function requestActivityCoaching(payload: {
  message: string;
  session_id?: string;
  activity_description: string;
  job_title: string;
  section_type: Activity["type"];
  history: CoachMessage[];
}): Promise<CoachFeedbackResponse> {
  return requestAppJson<CoachFeedbackResponse>(
    "/api/dashboard/activities/coach",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "AI coach request failed."
  );
}

export async function listActivities(): Promise<ActivityListResponse> {
  return requestAppJson<ActivityListResponse>(
    "/api/dashboard/activities",
    { method: "GET" },
    "활동 목록을 불러오지 못했습니다."
  );
}

export async function getActivityDetail(id: string): Promise<ActivityDetailResponse> {
  return requestAppJson<ActivityDetailResponse>(
    `/api/dashboard/activities/${encodeURIComponent(id)}`,
    { method: "GET" },
    "활동을 불러오지 못했습니다."
  );
}

export async function createActivity(payload: Record<string, unknown>): Promise<ActivityMutationResponse> {
  return requestAppJson<ActivityMutationResponse>(
    "/api/dashboard/activities",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "활동 저장에 실패했습니다."
  );
}

export async function updateActivity(id: string, payload: Record<string, unknown>): Promise<ActivityMutationResponse> {
  return requestAppJson<ActivityMutationResponse>(
    `/api/dashboard/activities/${encodeURIComponent(id)}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "활동 저장에 실패했습니다."
  );
}

export async function deleteActivity(id: string): Promise<{ id: string }> {
  return requestAppJson<{ id: string }>(
    `/api/dashboard/activities/${encodeURIComponent(id)}`,
    { method: "DELETE" },
    "활동 삭제에 실패했습니다."
  );
}

export async function uploadActivityImages(
  activityId: string,
  files: File[]
): Promise<{ urls: string[] }> {
  const formData = new FormData();
  formData.set("activityId", activityId);
  files.forEach((file) => formData.append("files", file));

  return requestAppJson<{ urls: string[] }>(
    "/api/dashboard/activities/images",
    { method: "POST", body: formData },
    "이미지 업로드에 실패했습니다."
  );
}

export async function saveCoachSession(payload: {
  sessionId: string;
  activityId: string;
  messages: CoachMessage[];
}): Promise<{ ok: true }> {
  return requestAppJson<{ ok: true }>(
    "/api/dashboard/activities/coach-session",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "코치 세션 저장에 실패했습니다."
  );
}

export async function getMatchDashboardData(): Promise<MatchDashboardResponse> {
  return requestAppJson<MatchDashboardResponse>(
    "/api/dashboard/match",
    { method: "GET" },
    "합격률 분석 데이터를 불러오지 못했습니다."
  );
}

export async function createMatchAnalysis(payload: {
  companyName: string;
  positionName: string;
  jobPosting: string;
  analysisMode: "resume" | "activity";
  selectedResumeId?: string;
}): Promise<{
  analysis: SavedMatchAnalysis;
}> {
  return requestAppJson(
    "/api/dashboard/match",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "합격률 분석에 실패했습니다."
  );
}

export async function deleteMatchAnalysis(id: string): Promise<{ id: string }> {
  return requestAppJson<{ id: string }>(
    `/api/dashboard/match?id=${encodeURIComponent(id)}`,
    { method: "DELETE" },
    "분석 삭제에 실패했습니다."
  );
}
