import { createClient } from "@supabase/supabase-js";
import { resolveServiceRoleSupabaseEnv } from "./env";

export function createServiceRoleSupabaseClient() {
  const { url, serviceRoleKey } = resolveServiceRoleSupabaseEnv();

  return createClient(url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
