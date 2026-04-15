import { NextResponse } from "next/server";

import { createServerSupabaseClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const next = requestUrl.searchParams.get("next");
  const redirectTarget = next && next.startsWith("/") ? next : "/landing-a";

  if (!code) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const supabase = await createServerSupabaseClient();
  const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
  if (exchangeError) {
    return NextResponse.redirect(new URL("/login?error=oauth_callback_failed", request.url));
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
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
