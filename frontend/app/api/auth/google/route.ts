import { NextResponse } from "next/server";

import { apiRateLimited } from "@/lib/api/route-response";
import { buildRateLimitKey, enforceRateLimit } from "@/lib/server/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  try {
    const rateLimit = enforceRateLimit({
      namespace: "auth-google",
      key: buildRateLimitKey(request, "auth-google"),
      maxRequests: 8,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return apiRateLimited(
        "로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.",
        rateLimit.retryAfterSeconds
      );
    }

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
