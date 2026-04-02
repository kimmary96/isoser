// FastAPI 백엔드 호출 함수 모음
import type {
  ParsePdfResponse,
  CoachFeedbackRequest,
  CoachFeedbackResponse,
  MatchAnalyzeRequest,
  MatchResult,
} from "@/lib/types";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

/** 공통 에러 처리 헬퍼 */
async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`백엔드 오류 (${res.status}): ${text}`);
  }
  return res.json() as Promise<T>;
}

/**
 * PDF 파싱 - 기존 이력서에서 프로필과 활동 목록 추출
 * POST /parse/pdf
 */
export async function parsePdf(file: File): Promise<ParsePdfResponse> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${BACKEND_URL}/parse/pdf`, {
    method: "POST",
    body: formData,
  });
  return handleResponse<ParsePdfResponse>(res);
}

/**
 * AI 코치 피드백 - 활동 설명에 대한 STAR 기반 피드백 생성
 * POST /coach/feedback
 */
export async function getCoachFeedback(
  request: CoachFeedbackRequest
): Promise<CoachFeedbackResponse> {
  const res = await fetch(`${BACKEND_URL}/coach/feedback`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  return handleResponse<CoachFeedbackResponse>(res);
}

/**
 * 공고 매칭 분석 - 채용 공고와 활동 목록 비교
 * POST /match/analyze
 */
export async function analyzeMatch(
  request: MatchAnalyzeRequest
): Promise<MatchResult> {
  const res = await fetch(`${BACKEND_URL}/match/analyze`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(request),
  });
  return handleResponse<MatchResult>(res);
}
