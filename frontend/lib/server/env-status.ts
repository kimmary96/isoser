function hasEnv(name: string): boolean {
  return Boolean(process.env[name]?.trim());
}

function normalizeBackendUrl(): string {
  return process.env.NEXT_PUBLIC_BACKEND_URL?.trim() || "http://localhost:8000";
}

function sanitizeUrlLabel(value: string): string {
  try {
    const parsed = new URL(value);
    return `${parsed.protocol}//${parsed.host}`;
  } catch {
    return value;
  }
}

export function getFrontendEnvStatus() {
  const backendUrl = normalizeBackendUrl();

  return {
    supabase: {
      urlConfigured: hasEnv("NEXT_PUBLIC_SUPABASE_URL"),
      anonKeyConfigured: hasEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
    },
    backend: {
      urlLabel: sanitizeUrlLabel(backendUrl),
      explicitEnvConfigured: hasEnv("NEXT_PUBLIC_BACKEND_URL"),
    },
    ai: {
      geminiConfigured: hasEnv("GEMINI_API_KEY"),
    },
    rateLimit: {
      upstashConfigured:
        hasEnv("UPSTASH_REDIS_REST_URL") && hasEnv("UPSTASH_REDIS_REST_TOKEN"),
    },
  };
}

export async function getBackendHealthStatus() {
  const backendUrl = normalizeBackendUrl();

  try {
    const response = await fetch(`${backendUrl}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(5_000),
      cache: "no-store",
    });

    if (!response.ok) {
      return {
        reachable: false,
        status: response.status,
        note: "backend_health_non_200",
      };
    }

    const data = (await response.json().catch(() => null)) as
      | { status?: string; service?: string }
      | null;

    return {
      reachable: true,
      status: response.status,
      service: data?.service ?? null,
      appStatus: data?.status ?? null,
      note: "ok",
    };
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return {
        reachable: false,
        status: null,
        note: "timeout",
      };
    }

    return {
      reachable: false,
      status: null,
      note: "request_failed",
    };
  }
}
