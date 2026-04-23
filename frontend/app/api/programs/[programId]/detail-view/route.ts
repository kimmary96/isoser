import { apiError, apiOk } from "@/lib/api/route-response";

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";

export async function POST(_: Request, { params }: { params: Promise<{ programId: string }> }) {
  try {
    const { programId } = await params;
    const response = await fetch(`${BACKEND_URL}/programs/${encodeURIComponent(programId)}/detail-view`, {
      method: "POST",
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => null);
      throw new Error(errorData?.detail || "프로그램 상세 진입을 기록하지 못했습니다.");
    }

    return apiOk({ ok: true as const });
  } catch (error) {
    const message = error instanceof Error ? error.message : "프로그램 상세 진입을 기록하지 못했습니다.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}
