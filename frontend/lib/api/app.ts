import type { Activity, MatchAnalysisRecord, Profile, Resume } from "@/lib/types";

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
