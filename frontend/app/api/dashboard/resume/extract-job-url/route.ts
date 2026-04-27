import { apiError, apiOk, apiRateLimited } from "@/lib/api/route-response";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { extractJobPostingTextFromUrl } from "@/lib/server/job-posting-url-extract";
import { logRouteError } from "@/lib/server/route-logging";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ExtractJobUrlResponse } from "@/lib/types";

type ExtractJobUrlRequestBody = {
  url?: string;
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

export async function POST(request: Request) {
  let userId: string | null = null;

  try {
    userId = await getAuthenticatedUserId();
    const rateLimit = await enforceRateLimit({
      namespace: "resume-url-extract",
      key: userId,
      maxRequests: 8,
      windowMs: 60_000,
    });

    if (!rateLimit.allowed) {
      return apiRateLimited(
        "URL 공고 추출 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
        rateLimit.retryAfterSeconds
      );
    }

    const body = (await request.json()) as ExtractJobUrlRequestBody;
    const url = body.url?.trim() ?? "";
    if (!url) {
      return apiError("공고 URL을 입력해주세요.", 400, "BAD_REQUEST");
    }

    const extracted = await extractJobPostingTextFromUrl(url);
    return apiOk<ExtractJobUrlResponse>(extracted);
  } catch (error) {
    logRouteError(
      {
        route: "/api/dashboard/resume/extract-job-url",
        method: "POST",
        category: "match",
        userId,
        status: 400,
      },
      error
    );
    const message = error instanceof Error ? error.message : "URL 공고 추출에 실패했습니다.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}
