import { apiError, apiOk, apiRateLimited } from "@/lib/api/route-response";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { logRouteError } from "@/lib/server/route-logging";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { MatchRewriteResponse } from "@/lib/types";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

type ResumeRewriteRequestBody = {
  job_posting_text?: string;
  job_title?: string;
  activity_ids?: string[];
  section_type?: string;
};

async function getAuthenticatedUserId() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("로그인이 필요합니다.");
  }

  return user.id;
}

function getUpstreamErrorMessage(errorData: unknown): string {
  if (errorData && typeof errorData === "object" && "detail" in errorData) {
    const detail = (errorData as { detail?: unknown }).detail;
    if (typeof detail === "string") return detail;
    if (Array.isArray(detail) && detail.length > 0) {
      const first = detail[0];
      if (first && typeof first === "object" && "msg" in first) {
        return String((first as { msg?: unknown }).msg);
      }
    }
  }

  return "공고 기준 문장 후보 생성에 실패했습니다.";
}

export async function POST(request: Request) {
  let userId: string | null = null;

  try {
    userId = await getAuthenticatedUserId();
    const rateLimit = await enforceRateLimit({
      namespace: "resume-rewrite",
      key: userId,
      maxRequests: 6,
      windowMs: 60_000,
    });

    if (!rateLimit.allowed) {
      return apiRateLimited(
        "문장 후보 생성 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
        rateLimit.retryAfterSeconds
      );
    }

    const body = (await request.json()) as ResumeRewriteRequestBody;
    const activityIds = Array.isArray(body.activity_ids)
      ? body.activity_ids.map((id) => String(id).trim()).filter(Boolean)
      : [];
    const jobPostingText = body.job_posting_text?.trim() ?? "";
    const jobTitle = body.job_title?.trim() ?? "";
    const sectionType = body.section_type?.trim() || "요약";

    if (jobPostingText.length < 50) {
      return apiError("공고 텍스트는 최소 50자 이상 필요합니다.", 400, "BAD_REQUEST");
    }
    if (!jobTitle) {
      return apiError("지원 직무를 입력해주세요.", 400, "BAD_REQUEST");
    }
    if (activityIds.length === 0) {
      return apiError("문장 후보를 만들 성과를 1개 이상 선택해주세요.", 400, "BAD_REQUEST");
    }

    const params = new URLSearchParams({ user_id: userId });
    const response = await fetch(`${BACKEND_URL}/match/rewrite?${params.toString()}`, {
      signal: AbortSignal.timeout(30_000),
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_posting_text: jobPostingText,
        job_title: jobTitle,
        activity_ids: activityIds,
        section_type: sectionType,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      return apiError(
        getUpstreamErrorMessage(errorData),
        response.status >= 500 ? 502 : 400,
        response.status >= 500 ? "UPSTREAM_ERROR" : "BAD_REQUEST"
      );
    }

    const data = (await response.json()) as MatchRewriteResponse;
    return apiOk<MatchRewriteResponse>(data);
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      logRouteError(
        {
          route: "/api/dashboard/resume/rewrite",
          method: "POST",
          category: "match",
          userId,
          status: 504,
          code: "UPSTREAM_ERROR",
          note: "timeout",
        },
        error
      );
      return apiError(
        "문장 후보 생성 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.",
        504,
        "UPSTREAM_ERROR"
      );
    }

    logRouteError(
      {
        route: "/api/dashboard/resume/rewrite",
        method: "POST",
        category: "match",
        userId,
        status: 400,
      },
      error
    );
    const message = error instanceof Error ? error.message : "공고 기준 문장 후보 생성에 실패했습니다.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}
