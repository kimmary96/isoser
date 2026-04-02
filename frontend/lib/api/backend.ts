import type {
  MatchAnalyzeRequest,
  MatchResult,
  ExtractJobImageResponse,
} from "@/lib/types";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

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

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.detail || "공고 매칭 분석 중 오류가 발생했습니다."
    );
  }

  return response.json();
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

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(
      errorData?.detail || "이미지 공고 추출 중 오류가 발생했습니다."
    );
  }

  return response.json();
}