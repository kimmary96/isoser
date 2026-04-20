import { apiOk } from "@/lib/api/route-response";
import { getBackendHealthStatus, getFrontendEnvStatus } from "@/lib/server/env-status";

export async function GET() {
  const env = getFrontendEnvStatus();
  const backendHealth = await getBackendHealthStatus();

  const ready =
    env.supabase.urlConfigured &&
    env.supabase.anonKeyConfigured &&
    env.ai.geminiConfigured &&
    backendHealth.reachable;

  return apiOk({
    status: ready ? "ok" : "degraded",
    checks: {
      env,
      backendHealth,
    },
  });
}
