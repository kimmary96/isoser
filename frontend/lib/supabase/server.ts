// 서버용 Supabase 클라이언트 - 서버 컴포넌트, API Route, Server Action에서 사용
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { resolveServerSupabaseEnv } from "./env";

type CookieToSet = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  const { url, anonKey } = resolveServerSupabaseEnv();

  return createServerClient(
    url,
    anonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          // Server Components can read cookies but cannot mutate them during render.
          // Supabase may still attempt to refresh the session, so ignore set failures here
          // and let middleware / route handlers persist cookies in writable contexts.
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
            );
          } catch {
            // no-op
          }
        },
      },
    }
  );
}
