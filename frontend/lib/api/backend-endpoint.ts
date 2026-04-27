const LOCAL_BACKEND_CANDIDATES = [
  "http://127.0.0.1:8000",
  "http://localhost:8000",
  "http://127.0.0.1:8001",
  "http://localhost:8001",
] as const;

function normalizeBackendUrl(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  if (!trimmed) {
    return null;
  }

  return trimmed.replace(/\/+$/, "");
}

function dedupeBackendUrls(values: Array<string | null | undefined>): string[] {
  const unique = new Set<string>();
  const ordered: string[] = [];

  for (const value of values) {
    const normalized = normalizeBackendUrl(value);
    if (!normalized || unique.has(normalized)) {
      continue;
    }
    unique.add(normalized);
    ordered.push(normalized);
  }

  return ordered;
}

function getBackendBaseUrls(): string[] {
  return dedupeBackendUrls([
    process.env.NEXT_PUBLIC_BACKEND_URL,
    process.env.BACKEND_URL,
    ...LOCAL_BACKEND_CANDIDATES,
  ]);
}

function isLocalBackendUrl(baseUrl: string): boolean {
  try {
    const parsed = new URL(baseUrl);
    return parsed.hostname === "127.0.0.1" || parsed.hostname === "localhost";
  } catch {
    return false;
  }
}

function isRetryableLocalBackendMessage(message: string): boolean {
  const normalized = message.toLowerCase();
  return (
    normalized.includes("supabase is not configured") ||
    normalized.includes("service unavailable") ||
    normalized.includes("failed to fetch") ||
    normalized.includes("fetch failed") ||
    normalized.includes("connect") ||
    normalized.includes("econnrefused")
  );
}

function shouldRetryLocalCandidate(
  baseUrl: string,
  status: number | null,
  message: string,
): boolean {
  if (!isLocalBackendUrl(baseUrl)) {
    return false;
  }

  if (status === null) {
    return true;
  }

  return status >= 500 && isRetryableLocalBackendMessage(message);
}

async function fetchWithOptionalTimeout(
  input: string,
  init: RequestInit,
  timeoutMs?: number,
): Promise<Response> {
  if (!timeoutMs || timeoutMs <= 0) {
    return fetch(input, init);
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(input, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchBackendResponse(
  path: string,
  init: RequestInit = {},
  options?: { timeoutMs?: number },
): Promise<Response> {
  const candidates = getBackendBaseUrls();
  let lastResponse: Response | null = null;
  let lastError: Error | null = null;

  for (const baseUrl of candidates) {
    const url = `${baseUrl}${path}`;

    try {
      const response = await fetchWithOptionalTimeout(url, init, options?.timeoutMs);
      if (response.ok) {
        return response;
      }

      const errorData = await response.clone().json().catch(() => null);
      const message =
        errorData?.error ||
        errorData?.detail ||
        response.statusText ||
        "backend request failed";

      if (shouldRetryLocalCandidate(baseUrl, response.status, String(message))) {
        lastResponse = response;
        lastError = new Error(String(message));
        continue;
      }

      return response;
    } catch (error) {
      if (options?.timeoutMs && error instanceof Error && error.name === "AbortError") {
        throw new Error("Backend request timed out.");
      }

      const message = error instanceof Error ? error.message : "backend request failed";
      if (shouldRetryLocalCandidate(baseUrl, null, message)) {
        lastError = error instanceof Error ? error : new Error(message);
        continue;
      }
      throw error;
    }
  }

  if (lastResponse) {
    return lastResponse;
  }

  throw lastError ?? new Error("No backend endpoint could be reached.");
}
