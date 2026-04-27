import { apiError, apiOk } from "@/lib/api/route-response";
import { toSelectionProgramCardItem } from "@/lib/program-card-items";
import { loadProgramCardSummariesByIds } from "@/lib/server/program-card-summary";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import type {
  DashboardCalendarSelectionsResponse,
  ProgramCardItem,
} from "@/lib/types";
import type { ProgramCardRouteClient } from "@/lib/server/program-card-summary";

function createCalendarDbClient() {
  try {
    return createServiceRoleSupabaseClient();
  } catch {
    return createServerSupabaseClient();
  }
}

async function getAuthenticatedClient() {
  const authClient = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await authClient.auth.getUser();

  if (error || !user) {
    throw new Error("로그인이 필요합니다.");
  }

  const supabase = await createCalendarDbClient();
  return { supabase, user };
}

function normalizeProgramIds(value: unknown): string[] {
  if (!Array.isArray(value)) return [];

  return value
    .map((item) => String(item ?? "").trim())
    .filter(Boolean)
    .slice(0, 3);
}

export async function GET() {
  try {
    const { supabase, user } = await getAuthenticatedClient();

    const { data: selectionRows, error: selectionError } = await supabase
      .from("calendar_program_selections")
      .select("program_id, position, updated_at")
      .eq("user_id", user.id)
      .order("position", { ascending: true })
      .order("updated_at", { ascending: false });

    if (selectionError) throw new Error(selectionError.message);

    const programIds = (selectionRows ?? [])
      .map((row) => String(row.program_id ?? "").trim())
      .filter(Boolean);

    if (programIds.length === 0) {
      return apiOk<DashboardCalendarSelectionsResponse>({ items: [] });
    }

    const programs = await loadProgramCardSummariesByIds(
      supabase as unknown as ProgramCardRouteClient,
      programIds
    );
    const programMap = new Map(
      programs.map((program) => [String(program.id ?? ""), program])
    );
    const items = programIds
      .map((programId, index) => {
        const program = programMap.get(programId);
        const selectedAt = (selectionRows ?? [])[index]?.updated_at ?? null;
        return program ? toSelectionProgramCardItem(program, selectedAt) : null;
      })
      .filter((item): item is ProgramCardItem => Boolean(item));

    return apiOk<DashboardCalendarSelectionsResponse>({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : "캘린더 적용 일정을 불러오지 못했습니다.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}

export async function PUT(request: Request) {
  try {
    const { supabase, user } = await getAuthenticatedClient();
    const body = (await request.json()) as { programIds?: unknown };
    const programIds = normalizeProgramIds(body.programIds);

    const { error: deleteError } = await supabase
      .from("calendar_program_selections")
      .delete()
      .eq("user_id", user.id);

    if (deleteError) throw new Error(deleteError.message);

    if (programIds.length > 0) {
      const { error: insertError } = await supabase.from("calendar_program_selections").insert(
        programIds.map((programId, index) => ({
          user_id: user.id,
          program_id: programId,
          position: index,
        }))
      );

      if (insertError) throw new Error(insertError.message);
    }

    return apiOk({ programIds });
  } catch (error) {
    const message = error instanceof Error ? error.message : "캘린더 적용 일정 저장에 실패했습니다.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}
