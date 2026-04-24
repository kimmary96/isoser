// 서버용 Supabase 클라이언트 - 서버 컴포넌트, API Route, Server Action에서 사용
import { createServerClient } from "@supabase/ssr";
import { existsSync, readFileSync } from "node:fs";
import { cookies } from "next/headers";
import { join } from "node:path";

type CookieToSet = {
  name: string;
  value: string;
  options?: Record<string, unknown>;
};

function readLocalEnvValue(name: string): string | null {
  const candidates = [
    join(process.cwd(), ".env.local"),
    join(process.cwd(), "frontend", ".env.local"),
    join(process.cwd(), "..", "frontend", ".env.local"),
    join(process.cwd(), "backend", ".env"),
    join(process.cwd(), "..", "backend", ".env"),
  ];

  for (const path of candidates) {
    if (!existsSync(path)) continue;
    const lines = readFileSync(path, "utf8").split(/\r?\n/);
    const line = lines.find((item) => item.startsWith(`${name}=`));
    if (!line) continue;
    return line.slice(name.length + 1).trim().replace(/^"|"$/g, "") || null;
  }

  return null;
}

function resolveServerSupabaseEnv() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    readLocalEnvValue("NEXT_PUBLIC_SUPABASE_URL") ||
    readLocalEnvValue("SUPABASE_URL");
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    readLocalEnvValue("NEXT_PUBLIC_SUPABASE_ANON_KEY");

  if (!url || !anonKey) {
    throw new Error("Supabase server env is not configured.");
  }

  return { url, anonKey };
}

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
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2])
          );
        },
      },
    }
  );
}
