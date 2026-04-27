import { NextResponse } from "next/server";

import { resolveInternalPath } from "@/lib/routes";
import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next");
  const redirectTarget = resolveInternalPath(next);

  if (!code) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const supabase = await createServerSupabaseClient();
  const { data: exchangeData, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return NextResponse.redirect(new URL("/login?error=oauth_callback_failed", request.url));
  }

  const user = exchangeData.user;
  if (!user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { data: profileRow } = await supabase
    .from("profiles")
    .select("id")
    .eq("id", user.id)
    .maybeSingle();

  if (profileRow?.id) {
    return NextResponse.redirect(new URL(redirectTarget, request.url));
  }

  return NextResponse.redirect(new URL("/onboarding", request.url));
}
