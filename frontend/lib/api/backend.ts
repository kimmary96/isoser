import type {
  ParsePdfResponse,
  CoachFeedbackRequest,
  CoachFeedbackResponse,
  MatchAnalyzeRequest,
  MatchResult,
  ExtractJobImageResponse,
} from "@/lib/types";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

async function handleResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
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
        `백엔드 연결 실패: ${BACKEND_URL} 에 접속할 수 없습니다. 백엔드 서버(uvicorn)가 실행 중인지 확인해주세요.`
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
    "PDF 파싱 중 오류가 발생했습니다."
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
    "코치 피드백 생성 중 오류가 발생했습니다."
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
    "공고 매칭 분석 중 오류가 발생했습니다."
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
    "이미지 공고 추출 중 오류가 발생했습니다."
  );
}
