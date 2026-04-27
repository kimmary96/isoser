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
  ProgramCardSummary,
  ProgramCountResponse,
  ProgramDetail,
  ProgramDetailBatchResponse,
  ProgramFilterOptionsResponse,
  ProgramListPageResponse,
  ProgramListParams,
  ProgramRecommendResponse,
  SkillSuggestResponse,
} from "@/lib/types";
import { fetchBackendResponse } from "./backend-endpoint";
import { buildPathWithSearchParams, buildProgramListSearchParams } from "./program-query";

const PROGRAM_DETAIL_TIMEOUT_MS = 3500;

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
  fallbackMessage: string,
  options?: { timeoutMs?: number }
): Promise<T> {
  try {
    const response = await fetchBackendResponse(path, init, options);
    return handleResponse<T>(response, fallbackMessage);
  } catch (error) {
    if (error instanceof Error && /failed to fetch/i.test(error.message)) {
      throw new Error(
        "Failed to connect to the backend. Check whether the backend server is running."
      );
    }
    throw error;
  }
}

function isRetryableLocalBackendMetadataError(error: unknown): boolean {
  if (!(error instanceof Error)) {
    return false;
  }

  const normalized = error.message.trim().toLowerCase();
  return (
    normalized.includes("supabase is not configured") ||
    normalized.includes("service unavailable") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("fetch failed") ||
    normalized.includes("connect") ||
    normalized.includes("no backend endpoint could be reached")
  );
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
  return requestJson<Program[]>(
    buildPathWithSearchParams("/programs/", buildProgramListSearchParams(params)),
    {
      method: "GET",
    },
    "Failed to load programs."
  );
}

export async function listProgramsPage(params?: ProgramListParams): Promise<ProgramListPageResponse> {
  return requestJson<ProgramListPageResponse>(
    buildPathWithSearchParams("/programs/list", buildProgramListSearchParams(params)),
    {
      method: "GET",
    },
    "Failed to load programs."
  );
}

export async function getProgramCount(params?: ProgramListParams): Promise<number> {
  const result = await requestJson<ProgramCountResponse>(
    buildPathWithSearchParams("/programs/count", buildProgramListSearchParams(params)),
    {
      method: "GET",
    },
    "Failed to load the program count."
  );
  return result.count;
}

export async function getProgramFilterOptions(params?: ProgramListParams): Promise<ProgramFilterOptionsResponse> {
  try {
    return await requestJson<ProgramFilterOptionsResponse>(
      buildPathWithSearchParams("/programs/filter-options", buildProgramListSearchParams(params)),
      {
        method: "GET",
      },
      "Failed to load program filter options."
    );
  } catch (error) {
    if (isRetryableLocalBackendMetadataError(error)) {
      return {
        sources: [],
        targets: [],
        selection_processes: [],
        employment_links: [],
      };
    }
    throw error;
  }
}

export async function getPrograms(programIds: string[]): Promise<ProgramCardSummary[]> {
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
    "Failed to load the program detail.",
    { timeoutMs: PROGRAM_DETAIL_TIMEOUT_MS }
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
