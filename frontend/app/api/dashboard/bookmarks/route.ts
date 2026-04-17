import { apiError, apiOk } from "@/lib/api/route-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Program } from "@/lib/types";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

type BackendBookmarkResponse = {
  items?: Array<{
    program_id?: string | null;
    created_at?: string | null;
    program?: Program | null;
  }>;
};

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();
    const accessToken = !error && session?.access_token ? session.access_token : null;

    if (!accessToken) {
      return apiError("로그인이 필요합니다.", 401, "UNAUTHORIZED");
    }

    const response = await fetch(`${BACKEND_URL}/bookmarks`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.detail || "찜한 프로그램을 불러오지 못했습니다.");
    }

    const data = (await response.json()) as BackendBookmarkResponse;
    const items = (data.items ?? []).map((item) => ({
      programId: item.program_id ?? null,
      createdAt: item.created_at ?? null,
      program: item.program ?? null,
    }));

    return apiOk({ items });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "찜한 프로그램을 불러오지 못했습니다.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}
