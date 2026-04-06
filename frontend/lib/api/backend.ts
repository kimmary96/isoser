import type {
  CoachFeedbackRequest,
  CoachFeedbackResponse,
  CoachSessionDetail,
  CoachSessionSummary,
  CompanyInsightResponse,
  ExtractJobImageResponse,
  ExtractJobPdfResponse,
  MatchAnalyzeRequest,
  MatchResult,
  ParsePdfResponse,
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
