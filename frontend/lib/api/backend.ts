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

/** 공통 에러 처리 */
async function handleResponse<T>(response: Response, fallbackMessage: string): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || fallbackMessage);
  }

  return response.json() as Promise<T>;
}

/** PDF 파싱 */
export async function parsePdf(file: File): Promise<ParsePdfResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${BACKEND_URL}/parse/pdf`, {
    method: "POST",
    body: formData,
  });

  return handleResponse<ParsePdfResponse>(response, "PDF 파싱 중 오류가 발생했습니다.");
}

/** AI 코치 피드백 */
export async function getCoachFeedback(
  payload: CoachFeedbackRequest
): Promise<CoachFeedbackResponse> {
  const response = await fetch(`${BACKEND_URL}/coach/feedback`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return handleResponse<CoachFeedbackResponse>(response, "코치 피드백 생성 중 오류가 발생했습니다.");
}

/** 공고 매칭 분석 */
export async function analyzeMatch(
  payload: MatchAnalyzeRequest
): Promise<MatchResult> {
  const response = await fetch(`${BACKEND_URL}/match/analyze`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  return handleResponse<MatchResult>(response, "공고 매칭 분석 중 오류가 발생했습니다.");
}

/** 이미지 공고 텍스트 추출 */
export async function extractJobImage(
  file: File
): Promise<ExtractJobImageResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const response = await fetch(`${BACKEND_URL}/match/extract-job-image`, {
    method: "POST",
    body: formData,
  });

  return handleResponse<ExtractJobImageResponse>(response, "이미지 공고 추출 중 오류가 발생했습니다.");
}
