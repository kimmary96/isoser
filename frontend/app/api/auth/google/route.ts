import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const supabase = await createServerSupabaseClient();
    const requestUrl = new URL(request.url);
    const origin = requestUrl.origin;
    const requestedNext = requestUrl.searchParams.get("next");
    const next = requestedNext && requestedNext.startsWith("/") ? requestedNext : "/landing-a";
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (error) {
      throw new Error(error.message);
    }

    if (!data.url) {
      throw new Error("로그인 URL을 생성하지 못했습니다.");
    }

    return NextResponse.redirect(data.url);
  } catch {
    return NextResponse.redirect(new URL("/login?error=oauth_start_failed", request.url));
  }
}
