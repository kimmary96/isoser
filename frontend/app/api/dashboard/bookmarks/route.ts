import { apiError, apiOk } from "@/lib/api/route-response";
import { toBookmarkProgramCardItem } from "@/lib/program-card-items";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type {
  DashboardBookmarksResponse,
  Program,
  ProgramCardItem,
} from "@/lib/types";

type BookmarkRow = {
  program_id: string | null;
  created_at: string | null;
};

export async function GET() {
  try {
    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      return apiError("로그인이 필요합니다.", 401, "UNAUTHORIZED");
    }

    const { data: bookmarkRows, error: bookmarkError } = await supabase
      .from("program_bookmarks")
      .select("program_id, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false });

    if (bookmarkError) {
      throw new Error(bookmarkError.message || "찜한 프로그램을 불러오지 못했습니다.");
    }

    const rows = ((bookmarkRows ?? []) as BookmarkRow[]).filter((row) => row.program_id);
    const programIds = rows.map((row) => String(row.program_id));
    const { data: programs, error: programsError } = programIds.length
      ? await supabase.from("programs").select("*").in("id", programIds)
      : { data: [] as Program[], error: null };

    if (programsError) {
      throw new Error(programsError.message || "찜한 프로그램 정보를 불러오지 못했습니다.");
    }

    const programMap = new Map(
      ((programs ?? []) as Program[]).map((program) => [String(program.id ?? ""), program])
    );
    const items = rows
      .map((item) => {
        const program = item.program_id ? programMap.get(String(item.program_id)) ?? null : null;
        return program ? toBookmarkProgramCardItem(program, item.created_at ?? null) : null;
      })
      .filter((item): item is ProgramCardItem => Boolean(item));

    return apiOk<DashboardBookmarksResponse>({ items });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "찜한 프로그램을 불러오지 못했습니다.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}
