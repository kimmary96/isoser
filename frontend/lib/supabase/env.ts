import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const LOCAL_ENV_CANDIDATES = [
  join(process.cwd(), ".env.local"),
  join(process.cwd(), "frontend", ".env.local"),
  join(process.cwd(), "..", "frontend", ".env.local"),
  join(process.cwd(), "backend", ".env"),
  join(process.cwd(), "..", "backend", ".env"),
];

export function readLocalEnvValue(name: string): string | null {
  for (const path of LOCAL_ENV_CANDIDATES) {
    if (!existsSync(path)) continue;
    const lines = readFileSync(path, "utf8").split(/\r?\n/);
    const line = lines.find((item) => item.startsWith(`${name}=`));
    if (!line) continue;
    return line.slice(name.length + 1).trim().replace(/^"|"$/g, "") || null;
  }

  return null;
}

export function resolveServerSupabaseEnv() {
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

export function resolveServiceRoleSupabaseEnv() {
  const url =
    process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() ||
    process.env.SUPABASE_URL?.trim() ||
    readLocalEnvValue("NEXT_PUBLIC_SUPABASE_URL") ||
    readLocalEnvValue("SUPABASE_URL");
  const serviceRoleKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY?.trim() ||
    readLocalEnvValue("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !serviceRoleKey) {
    throw new Error("Supabase service-role env is not configured.");
  }

  return { url, serviceRoleKey };
}
