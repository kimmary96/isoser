import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { ProgramRecommendResponse } from "@/lib/types";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { session },
      error,
    } = await supabase.auth.getSession();

    if (error || !session?.access_token) {
      throw new Error("로그인이 필요합니다.");
    }

    const response = await fetch(`${BACKEND_URL}/programs/recommend`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ top_k: 9 }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.detail || "추천 프로그램을 불러오지 못했습니다.");
    }

    const data = (await response.json()) as ProgramRecommendResponse;
    const programs = (data.items ?? [])
      .map((item) => item.program)
      .filter((program): program is NonNullable<typeof program> => Boolean(program))
      .slice(0, 9);

    return NextResponse.json({ programs });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "추천 프로그램을 불러오지 못했습니다.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
