import type {
  ActivityConvertRequest,
  ActivityConvertResponse,
  CoachFeedbackRequest,
  CoachFeedbackResponse,
  CoachIntroGenerateRequest,
  CoachIntroGenerateResponse,
  CoachSessionDetail,
  CoachSessionSummary,
  CompanyInsightResponse,
  ExtractJobImageResponse,
  ExtractJobPdfResponse,
  MatchAnalyzeRequest,
  MatchResult,
  ParsePdfResponse,
  Program,
  ProgramBatchResponse,
  ProgramCountResponse,
  ProgramDetail,
  ProgramDetailBatchResponse,
  ProgramFilterOptionsResponse,
  ProgramListParams,
  ProgramRecommendResponse,
  SkillSuggestResponse,
} from "@/lib/types";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

async function handleResponse<T>(
  response: Response,
  fallbackMessage: string
): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || fallbackMessage);
  }

  return response.json() as Promise<T>;
}

async function requestJson<T>(
  path: string,
  init: RequestInit,
  fallbackMessage: string
): Promise<T> {
  try {
    const response = await fetch(`${BACKEND_URL}${path}`, init);
    return handleResponse<T>(response, fallbackMessage);
  } catch (error) {
    if (error instanceof Error && /failed to fetch/i.test(error.message)) {
      throw new Error(
        `Failed to connect to the backend at ${BACKEND_URL}. Check whether the backend server is running.`
      );
    }
    throw error;
  }
}

export async function parsePdf(file: File): Promise<ParsePdfResponse> {
  const formData = new FormData();
  formData.append("file", file);

  return requestJson<ParsePdfResponse>(
    "/parse/pdf",
    {
      method: "POST",
      body: formData,
    },
    "PDF parsing failed."
  );
}

export async function getCoachFeedback(
  payload: CoachFeedbackRequest
): Promise<CoachFeedbackResponse> {
  return requestJson<CoachFeedbackResponse>(
    "/coach/feedback",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    "Coach feedback generation failed."
  );
}

export async function generateActivityIntro(
  payload: CoachIntroGenerateRequest
): Promise<CoachIntroGenerateResponse> {
  return requestJson<CoachIntroGenerateResponse>(
    "/coach/feedback",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    "Activity intro generation failed."
  );
}

export async function getCoachSessions(
  userId: string
): Promise<CoachSessionSummary[]> {
  const params = new URLSearchParams({ user_id: userId });

  return requestJson<CoachSessionSummary[]>(
    `/coach/sessions?${params.toString()}`,
    {
      method: "GET",
    },
    "Failed to load coach sessions."
  );
}

export async function getCoachSessionDetail(
  sessionId: string,
  userId: string
): Promise<CoachSessionDetail> {
  const params = new URLSearchParams({ user_id: userId });

  return requestJson<CoachSessionDetail>(
    `/coach/sessions/${sessionId}?${params.toString()}`,
    {
      method: "GET",
    },
    "Failed to load the coach session."
  );
}

export async function analyzeMatch(
  payload: MatchAnalyzeRequest
): Promise<MatchResult> {
  return requestJson<MatchResult>(
    "/match/analyze",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    "Match analysis failed."
  );
}

export async function extractJobImage(
  file: File
): Promise<ExtractJobImageResponse> {
  const formData = new FormData();
  formData.append("file", file);

  return requestJson<ExtractJobImageResponse>(
    "/match/extract-job-image",
    {
      method: "POST",
      body: formData,
    },
    "Image job posting extraction failed."
  );
}

export async function extractJobPdf(
  file: File
): Promise<ExtractJobPdfResponse> {
  const formData = new FormData();
  formData.append("file", file);

  return requestJson<ExtractJobPdfResponse>(
    "/match/extract-job-pdf",
    {
      method: "POST",
      body: formData,
    },
    "PDF job posting extraction failed."
  );
}

export async function getCompanyInsight(payload: {
  company_name: string;
}): Promise<CompanyInsightResponse> {
  return requestJson<CompanyInsightResponse>(
    "/company/insight",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    "Failed to load company insight."
  );
}

export async function getSkillSuggestions(
  role: string,
  limit = 20
): Promise<SkillSuggestResponse> {
  const params = new URLSearchParams({
    role,
    limit: String(limit),
  });

  return requestJson<SkillSuggestResponse>(
    `/skills/suggest?${params.toString()}`,
    {
      method: "GET",
    },
    "Failed to load skill suggestions."
  );
}

export async function convertActivity(
  payload: ActivityConvertRequest
): Promise<ActivityConvertResponse> {
  return requestJson<ActivityConvertResponse>(
    "/activities/convert",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    },
    "Activity conversion failed."
  );
}

export async function listPrograms(params?: ProgramListParams): Promise<Program[]> {
  const searchParams = new URLSearchParams();
  if (params?.q) searchParams.set("q", params.q);
  if (params?.category) searchParams.set("category", params.category);
  if (params?.category_detail) searchParams.set("category_detail", params.category_detail);
  if (params?.scope) searchParams.set("scope", params.scope);
  if (params?.region_detail) searchParams.set("region_detail", params.region_detail);
  if (params?.regions?.length) {
    params.regions.forEach((region) => searchParams.append("regions", region));
  }
  if (params?.sources?.length) {
    params.sources.forEach((source) => searchParams.append("sources", source));
  }
  if (params?.teaching_methods?.length) {
    params.teaching_methods.forEach((method) => searchParams.append("teaching_methods", method));
  }
  if (params?.cost_types?.length) {
    params.cost_types.forEach((costType) => searchParams.append("cost_types", costType));
  }
  if (params?.participation_times?.length) {
    params.participation_times.forEach((time) => searchParams.append("participation_times", time));
  }
  if (params?.targets?.length) {
    params.targets.forEach((target) => searchParams.append("targets", target));
  }
  if (params?.selection_processes?.length) {
    params.selection_processes.forEach((process) => searchParams.append("selection_processes", process));
  }
  if (params?.employment_links?.length) {
    params.employment_links.forEach((link) => searchParams.append("employment_links", link));
  }
  if (params?.recruiting_only) searchParams.set("recruiting_only", "true");
  if (params?.include_closed_recent) searchParams.set("include_closed_recent", "true");
  if (params?.sort) searchParams.set("sort", params.sort);
  if (typeof params?.limit === "number") searchParams.set("limit", String(params.limit));
  if (typeof params?.offset === "number") searchParams.set("offset", String(params.offset));

  const query = searchParams.toString();
  return requestJson<Program[]>(
    `/programs/${query ? `?${query}` : ""}`,
    {
      method: "GET",
    },
    "Failed to load programs."
  );
}

export async function getProgramCount(params?: ProgramListParams): Promise<number> {
  const searchParams = new URLSearchParams();
  if (params?.q) searchParams.set("q", params.q);
  if (params?.category) searchParams.set("category", params.category);
  if (params?.category_detail) searchParams.set("category_detail", params.category_detail);
  if (params?.scope) searchParams.set("scope", params.scope);
  if (params?.region_detail) searchParams.set("region_detail", params.region_detail);
  if (params?.regions?.length) {
    params.regions.forEach((region) => searchParams.append("regions", region));
  }
  if (params?.sources?.length) {
    params.sources.forEach((source) => searchParams.append("sources", source));
  }
  if (params?.teaching_methods?.length) {
    params.teaching_methods.forEach((method) => searchParams.append("teaching_methods", method));
  }
  if (params?.cost_types?.length) {
    params.cost_types.forEach((costType) => searchParams.append("cost_types", costType));
  }
  if (params?.participation_times?.length) {
    params.participation_times.forEach((time) => searchParams.append("participation_times", time));
  }
  if (params?.targets?.length) {
    params.targets.forEach((target) => searchParams.append("targets", target));
  }
  if (params?.selection_processes?.length) {
    params.selection_processes.forEach((process) => searchParams.append("selection_processes", process));
  }
  if (params?.employment_links?.length) {
    params.employment_links.forEach((link) => searchParams.append("employment_links", link));
  }
  if (params?.recruiting_only) searchParams.set("recruiting_only", "true");
  if (params?.include_closed_recent) searchParams.set("include_closed_recent", "true");

  const query = searchParams.toString();
  const result = await requestJson<ProgramCountResponse>(
    `/programs/count${query ? `?${query}` : ""}`,
    {
      method: "GET",
    },
    "Failed to load the program count."
  );
  return result.count;
}

export async function getProgramFilterOptions(params?: ProgramListParams): Promise<ProgramFilterOptionsResponse> {
  const searchParams = new URLSearchParams();
  if (params?.q) searchParams.set("q", params.q);
  if (params?.category) searchParams.set("category", params.category);
  if (params?.category_detail) searchParams.set("category_detail", params.category_detail);
  if (params?.scope) searchParams.set("scope", params.scope);
  if (params?.region_detail) searchParams.set("region_detail", params.region_detail);
  if (params?.regions?.length) {
    params.regions.forEach((region) => searchParams.append("regions", region));
  }
  if (params?.teaching_methods?.length) {
    params.teaching_methods.forEach((method) => searchParams.append("teaching_methods", method));
  }
  if (params?.recruiting_only) searchParams.set("recruiting_only", "true");
  if (params?.include_closed_recent) searchParams.set("include_closed_recent", "true");

  const query = searchParams.toString();
  return requestJson<ProgramFilterOptionsResponse>(
    `/programs/filter-options${query ? `?${query}` : ""}`,
    {
      method: "GET",
    },
    "Failed to load program filter options."
  );
}

export async function getProgram(programId: string): Promise<Program> {
  return requestJson<Program>(
    `/programs/${programId}`,
    {
      method: "GET",
    },
    "Failed to load the program."
  );
}

export async function getPrograms(programIds: string[]): Promise<Program[]> {
  const response = await requestJson<ProgramBatchResponse>(
    "/programs/batch",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ program_ids: programIds }),
    },
    "Failed to load programs."
  );
  return response.items;
}

export async function getProgramDetail(programId: string): Promise<ProgramDetail> {
  return requestJson<ProgramDetail>(
    `/programs/${programId}/detail`,
    {
      method: "GET",
    },
    "Failed to load the program detail."
  );
}

export async function getProgramDetails(programIds: string[]): Promise<ProgramDetail[]> {
  const response = await requestJson<ProgramDetailBatchResponse>(
    "/programs/details/batch",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ program_ids: programIds }),
    },
    "Failed to load program details."
  );
  return response.items;
}

export async function recommendPrograms(
  topK = 9,
  accessToken?: string | null
): Promise<ProgramRecommendResponse> {
  return requestJson<ProgramRecommendResponse>(
    "/programs/recommend",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      body: JSON.stringify({ top_k: topK }),
    },
    "Failed to load recommended programs."
  );
}
