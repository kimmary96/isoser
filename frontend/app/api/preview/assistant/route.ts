import { apiError, apiOk } from "@/lib/api/route-response";
import type { AssistantMessageRequest, AssistantMessageResponse } from "@/lib/types";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return apiError("Preview routes are disabled in production.", 404, "NOT_FOUND");
  }

  try {
    const body = (await request.json()) as AssistantMessageRequest;

    const response = await fetch(`${BACKEND_URL}/assistant/message`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      return apiError(
        errorData?.detail || errorData?.error || "Assistant preview request failed.",
        response.status >= 500 ? 502 : response.status,
        response.status >= 500 ? "UPSTREAM_ERROR" : "BAD_REQUEST"
      );
    }

    const data = (await response.json()) as AssistantMessageResponse;
    return apiOk<AssistantMessageResponse>(data);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Assistant preview request failed.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}
