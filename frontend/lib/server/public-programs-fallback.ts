import {
  legacyProgramRowToProgramCardSummary,
  readModelRowToProgramCardSummary,
} from "@/lib/server/program-card-summary";
import { matchesProgramFilterChip, matchesProgramKeyword } from "@/lib/program-filters";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import type { ProgramListRow } from "@/lib/types";

export const PUBLIC_PROGRAM_BROWSE_LIMIT = 300;
export const PUBLIC_PROGRAM_PROMOTED_LIMIT = 3;
export const PUBLIC_PROGRAM_URGENT_LIMIT = 12;

const LEGACY_PROGRAM_SCAN_LIMIT = 900;
const LEGACY_FILTERED_PROGRAM_SCAN_BATCH = 1000;
const LEGACY_FILTERED_PROGRAM_SCAN_MAX = 12000;

type PublicProgramsPageFallback = {
  programs: ProgramListRow[];
  promotedPrograms: ProgramListRow[];
  urgentPrograms: ProgramListRow[];
  totalCount: number;
};

type PublicProgramSort = "default" | "deadline" | "popular";

function getTodayDateString(): string {
  return new Date().toISOString().slice(0, 10);
}

async function createPublicFallbackClient() {
  try {
    return createServiceRoleSupabaseClient();
  } catch {
    return createServerSupabaseClient();
  }
}

function dedupePrograms(programs: ProgramListRow[], limit?: number): ProgramListRow[] {
  const seenIds = new Set<string>();
  const deduped: ProgramListRow[] = [];

  for (const program of programs) {
    const id = String(program.id ?? "").trim();
    if (!id || seenIds.has(id)) {
      continue;
    }
    seenIds.add(id);
    deduped.push(program);
    if (typeof limit === "number" && deduped.length >= limit) {
      break;
    }
  }

  return deduped;
}

function mergeProgramsBySort(
  programs: ProgramListRow[],
  sort: PublicProgramSort,
  limit: number
): ProgramListRow[] {
  return dedupePrograms(programs)
    .toSorted((left, right) => comparePrograms(left, right, sort))
    .slice(0, Math.max(1, limit));
}

function asNumber(value: unknown): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.replace(/,/g, ""));
    return Number.isFinite(parsed) ? parsed : 0;
  }
  return 0;
}

function programRatingValue(program: ProgramListRow): number {
  return asNumber(program.rating_normalized) || asNumber(program.rating_display) || asNumber(program.rating);
}

function programReviewCount(program: ProgramListRow): number {
  return asNumber(program.review_count);
}

function programRecommendedScore(program: ProgramListRow): number {
  return asNumber(program.recommended_score);
}

function programClickHotness(program: ProgramListRow): number {
  return asNumber(program.click_hotness_score) || asNumber(program.detail_view_count_7d) || asNumber(program.detail_view_count);
}

function programDaysLeft(program: ProgramListRow): number {
  if (typeof program.days_left === "number" && Number.isFinite(program.days_left)) {
    return program.days_left;
  }

  const deadline = Date.parse(String(program.deadline ?? ""));
  if (Number.isNaN(deadline)) {
    return Number.MAX_SAFE_INTEGER;
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const target = new Date(deadline);
  target.setHours(0, 0, 0, 0);
  return Math.round((target.getTime() - today.getTime()) / 86_400_000);
}

function programDeadlineTime(program: ProgramListRow): number {
  const deadline = Date.parse(String(program.deadline ?? ""));
  return Number.isNaN(deadline) ? Number.MAX_SAFE_INTEGER : deadline;
}

function programUrgencyBucket(program: ProgramListRow): number {
  const daysLeft = programDaysLeft(program);
  if (daysLeft < 0) {
    return 4;
  }
  if (daysLeft <= 7) {
    return 1;
  }
  if (daysLeft <= 30) {
    return 2;
  }
  return 3;
}

function comparePrograms(left: ProgramListRow, right: ProgramListRow, sort: PublicProgramSort): number {
  if (sort === "deadline") {
    return (
      programDeadlineTime(left) - programDeadlineTime(right) ||
      programRecommendedScore(right) - programRecommendedScore(left) ||
      programRatingValue(right) - programRatingValue(left) ||
      String(left.id ?? "").localeCompare(String(right.id ?? ""))
    );
  }

  if (sort === "popular") {
    return (
      programClickHotness(right) - programClickHotness(left) ||
      programRecommendedScore(right) - programRecommendedScore(left) ||
      programRatingValue(right) - programRatingValue(left) ||
      programDeadlineTime(left) - programDeadlineTime(right) ||
      String(left.id ?? "").localeCompare(String(right.id ?? ""))
    );
  }

  return (
    programUrgencyBucket(left) - programUrgencyBucket(right) ||
    programRecommendedScore(right) - programRecommendedScore(left) ||
    programRatingValue(right) - programRatingValue(left) ||
    programReviewCount(right) - programReviewCount(left) ||
    programDaysLeft(left) - programDaysLeft(right) ||
    programDeadlineTime(left) - programDeadlineTime(right) ||
    String(left.id ?? "").localeCompare(String(right.id ?? ""))
  );
}

function getPromotedProviderTerms(): string[] {
  const raw = process.env.PROGRAM_PROMOTED_PROVIDER_MATCHES ?? "패스트캠퍼스,Fast Campus,fastcampus";
  const terms: string[] = [];

  for (const value of raw.split(",")) {
    const normalized = value.trim();
    if (!normalized || terms.includes(normalized)) {
      continue;
    }
    terms.push(normalized);
  }

  return terms;
}

function markProgramAsPromoted(program: ProgramListRow, rank: number): ProgramListRow {
  const recommendationReasons = Array.isArray(program.recommendation_reasons)
    ? program.recommendation_reasons.filter((reason): reason is string => Boolean(reason?.trim()))
    : [];

  return {
    ...program,
    is_ad: true,
    promoted_rank: program.promoted_rank ?? rank,
    recommendation_reasons: ["광고", ...recommendationReasons.filter((reason) => reason !== "광고")],
  };
}

async function loadReadModelPrograms(options: {
  limit: number;
  sort: PublicProgramSort;
  onlyAds?: boolean;
}): Promise<ProgramListRow[]> {
  const supabase = await createPublicFallbackClient();
  const { limit, sort, onlyAds = false } = options;
  let query = supabase
    .from("program_list_index")
    .select("*")
    .eq("is_open", true)
    .eq("is_ad", onlyAds);

  if (!onlyAds && sort === "default") {
    query = query.lte("browse_rank", PUBLIC_PROGRAM_BROWSE_LIMIT);
  }

  if (onlyAds) {
    query = query
      .order("promoted_rank", { ascending: true, nullsFirst: false })
      .order("recommended_score", { ascending: false, nullsFirst: false })
      .order("id", { ascending: true });
  } else if (sort === "deadline") {
    query = query
      .order("deadline", { ascending: true, nullsFirst: false })
      .order("recommended_score", { ascending: false, nullsFirst: false })
      .order("id", { ascending: true });
  } else if (sort === "popular") {
    query = query
      .order("click_hotness_score", { ascending: false, nullsFirst: false })
      .order("deadline", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true });
  } else {
    query = query
      .order("recommended_score", { ascending: false, nullsFirst: false })
      .order("id", { ascending: true });
  }

  const { data, error } = await query.limit(Math.max(1, limit));
  if (error) {
    return [];
  }

  return dedupePrograms(
    (data ?? [])
      .map((row) => readModelRowToProgramCardSummary(row as Record<string, unknown>))
      .filter((program): program is ProgramListRow => Boolean(program))
  );
}

async function loadLegacyPrograms(options: {
  today: string;
  limit: number;
  sort: PublicProgramSort;
  onlyAds?: boolean;
  providerTerms?: string[];
}): Promise<ProgramListRow[]> {
  const supabase = await createPublicFallbackClient();
  const { today, limit, sort, onlyAds = false, providerTerms } = options;
  let query = supabase
    .from("programs")
    .select("*")
    .gte("deadline", today)
    .eq("is_ad", onlyAds)
    .order("deadline", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true });

  if (providerTerms?.length) {
    const clauses = providerTerms.flatMap((term) => [
      `provider.ilike.*${term}*`,
      `title.ilike.*${term}*`,
      `source.ilike.*${term}*`,
    ]);
    query = query.or(clauses.join(","));
  }

  const { data, error } = await query.limit(Math.max(limit, LEGACY_PROGRAM_SCAN_LIMIT));
  if (error) {
    throw new Error(error.message || "public programs legacy fallback query failed");
  }

  return dedupePrograms(
    (data ?? [])
      .map((row) => legacyProgramRowToProgramCardSummary(row as Record<string, unknown>))
      .filter((program): program is ProgramListRow => Boolean(program))
      .toSorted((left, right) => comparePrograms(left, right, sort)),
    limit
  );
}

async function scanLegacyProgramsUntilEnough(options: {
  today: string;
  limit: number;
  sort: PublicProgramSort;
  matcher: (program: ProgramListRow) => boolean;
}): Promise<ProgramListRow[]> {
  const { today, limit, sort, matcher } = options;
  const safeLimit = Math.max(1, limit);
  const supabase = await createPublicFallbackClient();
  const matchedPrograms: ProgramListRow[] = [];
  const seenIds = new Set<string>();

  for (
    let offset = 0;
    offset < LEGACY_FILTERED_PROGRAM_SCAN_MAX && matchedPrograms.length < safeLimit;
    offset += LEGACY_FILTERED_PROGRAM_SCAN_BATCH
  ) {
    const { data, error } = await supabase
      .from("programs")
      .select("*")
      .gte("deadline", today)
      .eq("is_ad", false)
      .order("deadline", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true })
      .range(offset, offset + LEGACY_FILTERED_PROGRAM_SCAN_BATCH - 1);

    if (error) {
      throw new Error(error.message || "public filtered programs fallback query failed");
    }

    const rows = data ?? [];
    if (rows.length === 0) {
      break;
    }

    for (const row of rows) {
      const program = legacyProgramRowToProgramCardSummary(row as Record<string, unknown>);
      if (!program || !matcher(program)) {
        continue;
      }

      const programId = String(program.id ?? "").trim();
      if (!programId || seenIds.has(programId)) {
        continue;
      }

      seenIds.add(programId);
      matchedPrograms.push(program);
      if (matchedPrograms.length >= safeLimit) {
        break;
      }
    }

    if (rows.length < LEGACY_FILTERED_PROGRAM_SCAN_BATCH) {
      break;
    }
  }

  return mergeProgramsBySort(matchedPrograms, sort, safeLimit);
}

async function loadOrganicPrograms(today: string, limit: number): Promise<ProgramListRow[]> {
  const [readModelPrograms, legacyPrograms] = await Promise.all([
    loadReadModelPrograms({ limit, sort: "default" }),
    loadLegacyPrograms({ today, limit, sort: "default" }),
  ]);

  return mergeProgramsBySort([...readModelPrograms, ...legacyPrograms], "default", limit);
}

async function loadUrgentPrograms(today: string, limit: number): Promise<ProgramListRow[]> {
  const [readModelPrograms, legacyPrograms] = await Promise.all([
    loadReadModelPrograms({ limit, sort: "deadline" }),
    loadLegacyPrograms({ today, limit, sort: "deadline" }),
  ]);

  return mergeProgramsBySort(
    [...readModelPrograms, ...legacyPrograms].filter((program) => programDaysLeft(program) >= 0),
    "deadline",
    limit
  );
}

async function loadPromotedPrograms(today: string, limit: number): Promise<ProgramListRow[]> {
  const promotedPrograms = loadReadModelPrograms({ limit, sort: "default", onlyAds: true }).then((programs) =>
    programs.map((program, index) => markProgramAsPromoted(program, index + 1))
  );
  const legacyAds = loadLegacyPrograms({ today, limit, sort: "default", onlyAds: true }).then((programs) =>
    programs.map((program, index) => markProgramAsPromoted(program, index + 1))
  );
  const [readModelAds, legacyExplicitAds] = await Promise.all([promotedPrograms, legacyAds]);

  const explicitAds = dedupePrograms([...readModelAds, ...legacyExplicitAds], limit);
  if (explicitAds.length >= limit) {
    return explicitAds.slice(0, limit);
  }

  const sponsoredPrograms = await loadLegacyPrograms({
    today,
    limit: Math.max(limit * 4, limit),
    sort: "default",
    providerTerms: getPromotedProviderTerms(),
  });

  const seenIds = new Set(explicitAds.map((program) => String(program.id ?? "")));
  const promotedRows = [...explicitAds];

  for (const program of sponsoredPrograms) {
    const id = String(program.id ?? "").trim();
    if (!id || seenIds.has(id)) {
      continue;
    }
    seenIds.add(id);
    promotedRows.push(markProgramAsPromoted(program, promotedRows.length + 1));
    if (promotedRows.length >= limit) {
      break;
    }
  }

  return promotedRows.slice(0, limit);
}

export async function loadPublicProgramsPageFallback(): Promise<PublicProgramsPageFallback> {
  const today = getTodayDateString();
  const [programs, promotedPrograms, urgentPrograms] = await Promise.all([
    loadOrganicPrograms(today, PUBLIC_PROGRAM_BROWSE_LIMIT),
    loadPromotedPrograms(today, PUBLIC_PROGRAM_PROMOTED_LIMIT),
    loadUrgentPrograms(today, PUBLIC_PROGRAM_URGENT_LIMIT),
  ]);

  return {
    programs,
    promotedPrograms,
    urgentPrograms,
    totalCount: programs.length,
  };
}

export async function loadPublicProgramFallbackRowsBySort(
  sort: PublicProgramSort,
  limit: number
): Promise<ProgramListRow[]> {
  const today = getTodayDateString();
  const safeLimit = Math.max(1, limit);

  if (sort === "deadline") {
    return loadUrgentPrograms(today, safeLimit);
  }

  if (sort === "popular") {
    const [readModelPrograms, legacyPrograms] = await Promise.all([
      loadReadModelPrograms({ limit: safeLimit, sort: "popular" }),
      loadLegacyPrograms({ today, limit: safeLimit, sort: "popular" }),
    ]);
    return mergeProgramsBySort([...readModelPrograms, ...legacyPrograms], "popular", safeLimit);
  }

  const { programs } = await loadPublicProgramsPageFallback();
  return programs.slice(0, safeLimit);
}

export async function loadPublicFreeProgramFallbackRows(limit: number): Promise<ProgramListRow[]> {
  const today = getTodayDateString();
  const safeLimit = Math.max(1, limit);
  return scanLegacyProgramsUntilEnough({
    today,
    limit: safeLimit,
    sort: "deadline",
    matcher: (program) => matchesProgramFilterChip(program, "무료"),
  });
}

export async function loadPublicFilteredProgramFallbackRows(options: {
  activeChip: string;
  keyword?: string;
  limit: number;
}): Promise<ProgramListRow[]> {
  const { activeChip, keyword = "", limit } = options;
  const today = getTodayDateString();
  const safeLimit = Math.max(1, limit);
  return scanLegacyProgramsUntilEnough({
    today,
    limit: safeLimit,
    sort: activeChip === "전체" ? "default" : "deadline",
    matcher: (program) =>
      matchesProgramFilterChip(program, activeChip) &&
      matchesProgramKeyword(program, keyword),
  });
}

export async function loadPublicProgramFallbackRows(limit: number): Promise<ProgramListRow[]> {
  const { programs } = await loadPublicProgramsPageFallback();
  return programs.slice(0, Math.max(1, limit));
}
