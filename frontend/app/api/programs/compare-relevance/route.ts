import { apiError, apiOk } from "@/lib/api/route-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ProgramCompareRelevanceResponse } from "@/lib/types";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => ({}))) as { programIds?: unknown };
    const programIds = Array.isArray(body.programIds)
      ? body.programIds.map((value) => String(value ?? "").trim()).filter(Boolean)
      : [];

    if (programIds.length === 0) {
      return apiOk<ProgramCompareRelevanceResponse>({ items: [] });
    }

    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    const accessToken = !error && session?.access_token ? session.access_token : null;

    if (!accessToken) {
      return apiError("로그인 후 관련도를 확인할 수 있습니다.", 401, "UNAUTHORIZED");
    }

    const response = await fetch(`${BACKEND_URL}/programs/compare-relevance`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ program_ids: programIds }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.detail || "관련도 비교 데이터를 불러오지 못했습니다.");
    }

    const data = (await response.json()) as ProgramCompareRelevanceResponse;
    return apiOk(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "관련도 비교 데이터를 불러오지 못했습니다.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}
