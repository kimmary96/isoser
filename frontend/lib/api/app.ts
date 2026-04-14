import type { Activity, MatchAnalysisRecord, Profile, Resume } from "@/lib/types";
import type { CoachMessage } from "@/lib/types";

type DashboardProfileResponse = {
  profile: Profile | null;
  activities: Activity[];
  matchAnalyses: MatchAnalysisRecord[];
};

type ResumeBuilderProfile = {
  name: string;
  bio?: string;
  email: string;
  phone: string;
  self_intro: string;
  skills: string[];
} | null;

type ResumeBuilderResponse = {
  activities: Activity[];
  profile: ResumeBuilderProfile;
};

type MatchDashboardResponse = {
  savedAnalyses: Array<{
    id: string;
    job_title: string;
    job_posting: string;
    total_score: number;
    grade: string;
    summary: string;
    created_at: string;
    result: import("@/lib/types").MatchResult | null;
  }>;
  resumeOptions: Array<{
    id: string;
    title: string;
    target_job: string | null;
    selected_activity_ids: string[] | null;
    created_at: string;
  }>;
};

async function handleResponse<T>(
  response: Response,
  fallbackMessage: string
): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.error || errorData?.detail || fallbackMessage);
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
  return requestAppJson<{ documents: Resume[] }>(
    "/api/dashboard/documents",
    { method: "GET" },
    "문서 목록을 불러오지 못했습니다."
  );
}

export async function listActivities(): Promise<{ activities: Activity[] }> {
  return requestAppJson<{ activities: Activity[] }>(
    "/api/dashboard/activities",
    { method: "GET" },
    "활동 목록을 불러오지 못했습니다."
  );
}

export async function getActivityDetail(id: string): Promise<{ activity: Activity | null }> {
  return requestAppJson<{ activity: Activity | null }>(
    `/api/dashboard/activities/${encodeURIComponent(id)}`,
    { method: "GET" },
    "활동을 불러오지 못했습니다."
  );
}

export async function createActivity(payload: Record<string, unknown>): Promise<{ activity: Activity }> {
  return requestAppJson<{ activity: Activity }>(
    "/api/dashboard/activities",
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
    "활동 저장에 실패했습니다."
  );
}

export async function updateActivity(id: string, payload: Record<string, unknown>): Promise<{ activity: Activity }> {
  return requestAppJson<{ activity: Activity }>(
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
  analysis: {
    id: string;
    job_title: string;
    job_posting: string;
    total_score: number;
    grade: string;
    summary: string;
    created_at: string;
    result: import("@/lib/types").MatchResult | null;
  };
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
