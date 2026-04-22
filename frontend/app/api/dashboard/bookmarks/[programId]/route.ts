import { apiError, apiOk } from "@/lib/api/route-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

async function forwardBookmarkMutation(programId: string, method: "POST" | "DELETE") {
  const supabase = await createServerSupabaseClient();
  const {
    data: { session },
    error,
  } = await supabase.auth.getSession();
  const accessToken = !error && session?.access_token ? session.access_token : null;

  if (!accessToken) {
    return apiError("로그인 후 찜할 수 있습니다.", 401, "UNAUTHORIZED");
  }

  const response = await fetch(`${BACKEND_URL}/bookmarks/${encodeURIComponent(programId)}`, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    throw new Error(errorData?.detail || "찜 상태를 변경하지 못했습니다.");
  }

  return apiOk({ ok: true });
}

export async function POST(_: Request, { params }: { params: Promise<{ programId: string }> }) {
  try {
    const { programId } = await params;
    return await forwardBookmarkMutation(programId, "POST");
  } catch (error) {
    const message = error instanceof Error ? error.message : "찜 상태를 변경하지 못했습니다.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}

export async function DELETE(_: Request, { params }: { params: Promise<{ programId: string }> }) {
  try {
    const { programId } = await params;
    return await forwardBookmarkMutation(programId, "DELETE");
  } catch (error) {
    const message = error instanceof Error ? error.message : "찜 상태를 변경하지 못했습니다.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}
