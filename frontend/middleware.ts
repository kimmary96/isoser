import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

export async function middleware(request: NextRequest) {
  if (request.nextUrl.pathname === "/programs/compare") {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/compare";
    return NextResponse.redirect(redirectUrl);
  }

  if (request.nextUrl.pathname === "/" && request.nextUrl.searchParams.has("code")) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/auth/callback";
    if (!redirectUrl.searchParams.get("next")) {
      redirectUrl.searchParams.set("next", "/landing-a");
    }
    return NextResponse.redirect(redirectUrl);
  }

  let response = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;
  const requiresAuth =
    pathname === "/onboarding" || pathname.startsWith("/dashboard");

  if (user && pathname === "/login") {
    const redirectUrl = request.nextUrl.clone();
    const redirectedFrom = redirectUrl.searchParams.get("redirectedFrom");
    redirectUrl.pathname = redirectedFrom && redirectedFrom.startsWith("/") ? redirectedFrom : "/landing-a";
    redirectUrl.search = "";
    return NextResponse.redirect(redirectUrl);
  }

  if (requiresAuth && !user) {
    const redirectUrl = request.nextUrl.clone();
    redirectUrl.pathname = "/login";
    redirectUrl.searchParams.set("redirectedFrom", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
