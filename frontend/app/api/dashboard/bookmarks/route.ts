import { apiError, apiOk } from "@/lib/api/route-response";
import { toBookmarkProgramCardItem } from "@/lib/program-card-items";
import {
  legacyProgramRowToProgramCardSummary,
  loadProgramCardSummariesByIds,
} from "@/lib/server/program-card-summary";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import type {
  DashboardBookmarksResponse,
  ProgramCardItem,
  ProgramCardSummary,
} from "@/lib/types";
import type { ProgramCardRouteClient } from "@/lib/server/program-card-summary";

type BookmarkRow = {
  program_id: string | null;
  created_at: string | null;
};

const BOOKMARK_PROGRAM_LIMIT = 30;

type BookmarkDbClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: string,
      ) => {
        order: (
          column: string,
          options: { ascending: boolean },
        ) => {
          limit: (count: number) => PromiseLike<{
            data: Record<string, unknown>[] | null;
            error: { code?: string | null; message?: string | null } | null;
          }>;
        };
      };
      in: (
        column: string,
        values: string[],
      ) => PromiseLike<{
        data: Record<string, unknown>[] | null;
        error: { code?: string | null; message?: string | null } | null;
      }>;
    };
  };
};

function createBookmarkDbClient() {
  try {
    return createServiceRoleSupabaseClient();
  } catch {
    return createServerSupabaseClient();
  }
}

function isIgnorableLegacyBookmarkError(error: { code?: string | null; message?: string | null } | null) {
  if (!error) {
    return false;
  }

  const code = String(error.code ?? "").toUpperCase();
  const message = String(error.message ?? "").toLowerCase();
  return code === "42P01" || code === "42703" || message.includes("bookmarks");
}

async function loadBookmarkRows(
  supabase: BookmarkDbClient,
  userId: string
): Promise<BookmarkRow[]> {
  const { data, error } = await supabase
    .from("program_bookmarks")
    .select("program_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(BOOKMARK_PROGRAM_LIMIT);

  if (error) {
    throw new Error(error.message || "찜한 프로그램을 불러오지 못했습니다.");
  }

  const primaryRows = ((data ?? []) as BookmarkRow[]).filter((row) => row.program_id);
  if (primaryRows.length > 0) {
    return primaryRows;
  }

  const legacyResult = await supabase
    .from("bookmarks")
    .select("program_id, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(BOOKMARK_PROGRAM_LIMIT);

  if (legacyResult.error && !isIgnorableLegacyBookmarkError(legacyResult.error)) {
    throw new Error(legacyResult.error.message || "찜한 프로그램을 불러오지 못했습니다.");
  }

  return ((legacyResult.data ?? []) as BookmarkRow[]).filter((row) => row.program_id);
}

async function loadBookmarkProgramSummaries(
  supabase: BookmarkDbClient,
  programIds: string[]
): Promise<ProgramCardSummary[]> {
  const orderedIds = programIds.filter(Boolean);
  if (orderedIds.length === 0) {
    return [];
  }

  const programMap = new Map<string, ProgramCardSummary>();
  const { data, error } = await supabase
    .from("programs")
    .select("*")
    .in("id", orderedIds);

  if (!error) {
    for (const row of data ?? []) {
      const program = legacyProgramRowToProgramCardSummary(row);
      if (program?.id) {
        programMap.set(String(program.id), program);
      }
    }
  }

  const missingIds = orderedIds.filter((programId) => !programMap.has(programId));
  if (missingIds.length > 0) {
    const fallbackPrograms = await loadProgramCardSummariesByIds(
      supabase as unknown as ProgramCardRouteClient,
      missingIds
    );
    for (const program of fallbackPrograms) {
      if (program.id) {
        programMap.set(String(program.id), program);
      }
    }
  }

  return orderedIds
    .map((programId) => programMap.get(programId) ?? null)
    .filter((program): program is ProgramCardSummary => Boolean(program));
}

export async function GET() {
  try {
    const authClient = await createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await authClient.auth.getUser();

    if (error || !user) {
      return apiError("로그인이 필요합니다.", 401, "UNAUTHORIZED");
    }

    const supabase = (await createBookmarkDbClient()) as unknown as BookmarkDbClient;

    const rows = await loadBookmarkRows(supabase, user.id);
    const programIds = rows.map((row) => String(row.program_id));
    if (programIds.length === 0) {
      return apiOk<DashboardBookmarksResponse>({ items: [] });
    }

    const programs = await loadBookmarkProgramSummaries(supabase, programIds);
    const programMap = new Map(
      programs.map((program) => [String(program.id ?? ""), program])
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
