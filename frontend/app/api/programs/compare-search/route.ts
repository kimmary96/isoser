import { apiError, apiOk } from "@/lib/api/route-response";
import { listProgramSelectSummaries } from "@/lib/api/backend";
import type { ProgramCompareSearchResponse, ProgramSort } from "@/lib/types";

const ALLOWED_SORTS = new Set<ProgramSort>([
  "default",
  "deadline",
  "popular",
  "start_soon",
  "cost_low",
  "cost_high",
  "duration_short",
  "duration_long",
]);

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const q = searchParams.get("q")?.trim() || undefined;
    const limitParam = Number(searchParams.get("limit"));
    const sortParam = searchParams.get("sort")?.trim() || "deadline";
    const recruitingOnly = searchParams.get("recruiting_only") === "true";
    const limit = Number.isFinite(limitParam)
      ? Math.max(1, Math.min(50, Math.trunc(limitParam)))
      : 20;
    const sort = ALLOWED_SORTS.has(sortParam as ProgramSort)
      ? (sortParam as ProgramSort)
      : "deadline";

    const items = await listProgramSelectSummaries({
      q,
      limit,
      sort,
      recruiting_only: recruitingOnly,
    });

    return apiOk<ProgramCompareSearchResponse>({ items });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "프로그램 검색 결과를 불러오지 못했습니다.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}
