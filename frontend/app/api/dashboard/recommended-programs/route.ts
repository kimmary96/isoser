import { apiError, apiOk } from "@/lib/api/route-response";
import { fetchBackendResponse } from "@/lib/api/backend-endpoint";
import { DASHBOARD_COPY } from "@/app/dashboard/dashboard-copy";
import {
  isProgramCardOpen,
  toProgramCardItem,
  toRecommendationProgramCardItem,
} from "@/lib/program-card-items";
import {
  loadDeadlineOrderedProgramCardSummaries,
  type ProgramCardDeadlineRouteClient,
} from "@/lib/server/program-card-summary";
import { extractBackendFallbackPrograms } from "@/lib/server/recommend-calendar-fallback";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import { createServiceRoleSupabaseClient } from "@/lib/supabase/service-role";
import type {
  DashboardRecommendedProgramsResponse,
  ProgramCardItem,
  ProgramCardSummary,
  ProgramListPageResponse,
  ProgramRecommendResponse,
} from "@/lib/types";

const BACKEND_RECOMMEND_TIMEOUT_MS = 3500;
const BACKEND_FALLBACK_TIMEOUT_MS = 2500;
const RECOMMENDATION_LIMIT = 5;
const CANDIDATE_POOL_LIMIT = 80;

type ServerSupabaseClient = Awaited<ReturnType<typeof createServerSupabaseClient>>;

function cleanText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((item) => cleanText(item))
    .filter((item): item is string => Boolean(item));
}

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}+#.]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: unknown): string[] {
  return normalizeText(value)
    .split(" ")
    .map((token) => token.trim())
    .filter((token) => token.length >= 2);
}

function addTerms(target: string[], value: unknown) {
  const text = cleanText(value);
  if (!text) {
    return;
  }

  target.push(text);
  target.push(...tokenize(text));
}

function compactTerms(values: string[]): string[] {
  const seen = new Set<string>();
  const terms: string[] = [];

  for (const value of values) {
    const normalized = normalizeText(value);
    if (!normalized || normalized.length < 2 || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    terms.push(normalized);
  }

  return terms.slice(0, 160);
}

function formatLocalDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isIgnorableMissingTableError(error: { code?: string | null; message?: string | null } | null) {
  if (!error) {
    return false;
  }

  const code = String(error.code ?? "").toUpperCase();
  const message = String(error.message ?? "").toLowerCase();
  return code === "42P01" || code === "42703" || message.includes("does not exist");
}

async function loadUserRecommendationTerms(
  supabase: ServerSupabaseClient,
  userId: string
): Promise<string[]> {
  const terms: string[] = [];

  const recommendationProfile = await supabase
    .from("user_recommendation_profile")
    .select(
      "effective_target_job,profile_keywords,evidence_skills,desired_skills,activity_keywords,preferred_regions"
    )
    .eq("user_id", userId)
    .maybeSingle();

  if (recommendationProfile.error && !isIgnorableMissingTableError(recommendationProfile.error)) {
    throw new Error(recommendationProfile.error.message);
  }

  const recommendationRow = recommendationProfile.data as Record<string, unknown> | null;
  if (recommendationRow) {
    addTerms(terms, recommendationRow.effective_target_job);
    for (const key of [
      "profile_keywords",
      "evidence_skills",
      "desired_skills",
      "activity_keywords",
      "preferred_regions",
    ]) {
      asStringArray(recommendationRow[key]).forEach((item) => addTerms(terms, item));
    }
  }

  const [profileResult, activitiesResult, resumesResult, coverLettersResult, bookmarksResult] =
    await Promise.allSettled([
      supabase
        .from("profiles")
        .select(
          "target_job,bio,self_intro,skills,career,education_history,awards,certifications,languages,region,region_detail"
        )
        .eq("id", userId)
        .maybeSingle(),
      supabase
        .from("activities")
        .select("title,organization,role,my_role,skills,description,contributions")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(20),
      supabase
        .from("resumes")
        .select("title,target_job")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(10),
      supabase
        .from("cover_letters")
        .select("title,company_name,job_title,prompt_question,content,tags")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false })
        .limit(10),
      supabase
        .from("program_bookmarks")
        .select("program_id")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(20),
    ]);

  if (profileResult.status === "fulfilled" && !profileResult.value.error) {
    const profile = profileResult.value.data as Record<string, unknown> | null;
    if (profile) {
      [
        "target_job",
        "bio",
        "self_intro",
        "region",
        "region_detail",
      ].forEach((key) => addTerms(terms, profile[key]));
      [
        "skills",
        "career",
        "education_history",
        "awards",
        "certifications",
        "languages",
      ].forEach((key) => asStringArray(profile[key]).forEach((item) => addTerms(terms, item)));
    }
  }

  if (activitiesResult.status === "fulfilled" && !activitiesResult.value.error) {
    for (const row of (activitiesResult.value.data ?? []) as Record<string, unknown>[]) {
      ["title", "organization", "role", "my_role", "description"].forEach((key) =>
        addTerms(terms, row[key])
      );
      asStringArray(row.skills).forEach((item) => addTerms(terms, item));
      asStringArray(row.contributions).forEach((item) => addTerms(terms, item));
    }
  }

  if (resumesResult.status === "fulfilled" && !resumesResult.value.error) {
    for (const row of (resumesResult.value.data ?? []) as Record<string, unknown>[]) {
      addTerms(terms, row.title);
      addTerms(terms, row.target_job);
    }
  }

  if (coverLettersResult.status === "fulfilled" && !coverLettersResult.value.error) {
    for (const row of (coverLettersResult.value.data ?? []) as Record<string, unknown>[]) {
      ["title", "company_name", "job_title", "prompt_question", "content"].forEach((key) =>
        addTerms(terms, row[key])
      );
      asStringArray(row.tags).forEach((item) => addTerms(terms, item));
    }
  }

  if (bookmarksResult.status === "fulfilled" && !bookmarksResult.value.error) {
    const bookmarkProgramIds = ((bookmarksResult.value.data ?? []) as Record<string, unknown>[])
      .map((row) => cleanText(row.program_id))
      .filter((programId): programId is string => Boolean(programId));

    if (bookmarkProgramIds.length > 0) {
      const bookmarkedPrograms = await supabase
        .from("programs")
        .select("title,category,category_detail,skills,tags,summary,description,location")
        .in("id", bookmarkProgramIds);

      if (!bookmarkedPrograms.error) {
        for (const row of (bookmarkedPrograms.data ?? []) as Record<string, unknown>[]) {
          [
            "title",
            "category",
            "category_detail",
            "summary",
            "description",
            "location",
          ].forEach((key) => addTerms(terms, row[key]));
          asStringArray(row.skills).forEach((item) => addTerms(terms, item));
          asStringArray(row.tags).forEach((item) => addTerms(terms, item));
        }
      }
    }
  }

  return compactTerms(terms);
}

async function loadOpenCandidatePrograms(
  supabase: ProgramCardDeadlineRouteClient,
  limit: number
): Promise<ProgramCardSummary[]> {
  try {
    const fallbackResponse = await fetchBackendResponse(
      `/programs/list?recruiting_only=true&sort=deadline&limit=${limit}`,
      { method: "GET" },
      { timeoutMs: BACKEND_FALLBACK_TIMEOUT_MS }
    );

    if (fallbackResponse.ok) {
      const fallbackPage = (await fallbackResponse.json().catch(() => null)) as ProgramListPageResponse | null;
      const programs = fallbackPage ? extractBackendFallbackPrograms(fallbackPage) : [];
      if (programs.length > 0) {
        return programs;
      }
    }
  } catch {
    // Fall through to Supabase direct fallback below.
  }

  return loadDeadlineOrderedProgramCardSummaries(supabase, {
    today: formatLocalDateKey(),
    limit,
  });
}

function programSearchText(program: ProgramCardSummary): string {
  return normalizeText(
    [
      program.title,
      program.category,
      program.category_detail,
      program.location,
      program.provider,
      program.summary,
      program.description,
      Array.isArray(program.skills) ? program.skills.join(" ") : program.skills,
      Array.isArray(program.tags) ? program.tags.join(" ") : program.tags,
      program.display_categories?.join(" "),
      program.extracted_keywords?.join(" "),
      program.selection_process_label,
      program.participation_mode_label,
      program.participation_time_text,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function scoreProgramAgainstTerms(program: ProgramCardSummary, terms: string[]): number {
  if (terms.length === 0) {
    return 0;
  }

  const haystack = programSearchText(program);
  if (!haystack) {
    return 0;
  }

  let score = 0;
  const matchedTokens = new Set<string>();
  for (const term of terms) {
    if (term.length >= 4 && haystack.includes(term)) {
      score += 12;
      matchedTokens.add(term);
      continue;
    }

    if (term.length >= 2 && haystack.includes(term) && !matchedTokens.has(term)) {
      score += 4;
      matchedTokens.add(term);
    }
  }

  return score;
}

function normalizeScore(value: number | null | undefined): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return value <= 1 ? value * 100 : value;
}

function qualityScore(program: ProgramCardSummary): number {
  const recommendationScore = Math.max(
    normalizeScore(program.recommended_score),
    normalizeScore(program.final_score),
    normalizeScore(program.relevance_score),
    normalizeScore(program.urgency_score)
  );
  const daysLeft =
    typeof program.days_left === "number" && Number.isFinite(program.days_left)
      ? program.days_left
      : null;
  const deadlineScore = daysLeft === null ? 8 : Math.max(0, 30 - Math.min(daysLeft, 30));
  const detailScore =
    (program.title ? 8 : 0) +
    (program.summary || program.description ? 5 : 0) +
    ((Array.isArray(program.skills) && program.skills.length > 0) ||
    (Array.isArray(program.extracted_keywords) && program.extracted_keywords.length > 0)
      ? 6
      : 0);
  const popularityScore = Math.min(Number(program.detail_view_count_7d ?? 0), 10);

  return recommendationScore * 0.4 + deadlineScore + detailScore + popularityScore;
}

function toUserDbMatchItem(program: ProgramCardSummary, score: number): ProgramCardItem | null {
  if (!program.id) {
    return null;
  }

  return toProgramCardItem(
    program,
    {
      surface: "dashboard_user_db_match",
      reason: "내 이력과 활동 키워드가 가까운 과정입니다.",
      score,
      relevance_score: score,
      relevance_reasons: [],
      fit_keywords: [],
      score_breakdown: {},
      relevance_grade: "none",
      relevance_badge: null,
    },
    {
      final_score: score,
      recommended_score: score,
    }
  );
}

function toQualityFallbackItem(program: ProgramCardSummary, score: number): ProgramCardItem | null {
  if (!program.id) {
    return null;
  }

  return toProgramCardItem(
    program,
    {
      surface: "dashboard_quality_open_fallback",
      reason: "모집중인 과정 중 먼저 확인하기 좋은 후보입니다.",
      score,
      relevance_score: null,
      relevance_reasons: [],
      fit_keywords: [],
      score_breakdown: {},
      relevance_grade: "none",
      relevance_badge: null,
    },
    {
      final_score: score,
      recommended_score: score,
    }
  );
}

function dedupeAndFill(
  groups: ProgramCardItem[][],
  limit: number
): ProgramCardItem[] {
  const seen = new Set<string>();
  const items: ProgramCardItem[] = [];

  for (const group of groups) {
    for (const item of group) {
      const programId = String(item.program.id ?? "").trim();
      if (!programId || seen.has(programId) || !isProgramCardOpen(item)) {
        continue;
      }
      seen.add(programId);
      items.push(item);
      if (items.length >= limit) {
        return items;
      }
    }
  }

  return items;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const category = searchParams.get("category")?.trim() || undefined;
    const region = searchParams.get("region")?.trim() || undefined;
    const forceRefresh = searchParams.get("force_refresh") === "true";

    const supabase = await createServerSupabaseClient();
    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    const {
      data: { session: authSession },
      error: sessionError,
    } = await supabase.auth.getSession();

    const accessToken = !sessionError && authSession?.access_token ? authSession.access_token : null;
    const headers: HeadersInit = {
      "Content-Type": "application/json",
    };

    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    const engineItems: ProgramCardItem[] = [];
    if (accessToken) {
      try {
        const response = await fetchBackendResponse(
          "/programs/recommend",
          {
            method: "POST",
            headers,
            body: JSON.stringify({
              top_k: RECOMMENDATION_LIMIT,
              category,
              region,
              force_refresh: forceRefresh,
            }),
          },
          { timeoutMs: BACKEND_RECOMMEND_TIMEOUT_MS },
        );

        if (response.ok) {
          const data = (await response.json()) as ProgramRecommendResponse;
          engineItems.push(
            ...(data.items ?? [])
              .map(toRecommendationProgramCardItem)
              .filter((item): item is ProgramCardItem => Boolean(item))
              .filter(isProgramCardOpen)
          );
        }
      } catch {
        // User DB and open-quality fallback below keep the dashboard populated.
      }
    }

    let fallbackSupabase: ProgramCardDeadlineRouteClient;
    try {
      fallbackSupabase = createServiceRoleSupabaseClient() as unknown as ProgramCardDeadlineRouteClient;
    } catch {
      fallbackSupabase = supabase as unknown as ProgramCardDeadlineRouteClient;
    }

    const candidatePrograms = (
      await loadOpenCandidatePrograms(fallbackSupabase, CANDIDATE_POOL_LIMIT)
    ).filter((program) => isProgramCardOpen({ program }));
    const userTerms = !error && user?.id ? await loadUserRecommendationTerms(supabase, user.id) : [];

    const userDbItems = candidatePrograms
      .map((program) => ({
        program,
        score: scoreProgramAgainstTerms(program, userTerms),
      }))
      .filter((item) => item.score > 0)
      .sort((left, right) => {
        const scoreDiff = right.score - left.score;
        if (scoreDiff !== 0) return scoreDiff;
        return qualityScore(right.program) - qualityScore(left.program);
      })
      .map((item) => toUserDbMatchItem(item.program, item.score))
      .filter((item): item is ProgramCardItem => Boolean(item));

    const qualityItems = candidatePrograms
      .map((program) => ({ program, score: qualityScore(program) }))
      .sort((left, right) => right.score - left.score)
      .map((item) => toQualityFallbackItem(item.program, item.score))
      .filter((item): item is ProgramCardItem => Boolean(item));

    const items = dedupeAndFill(
      [engineItems, userDbItems, qualityItems],
      RECOMMENDATION_LIMIT
    );

    return apiOk<DashboardRecommendedProgramsResponse>({ items });
  } catch (error) {
    const message = error instanceof Error ? error.message : DASHBOARD_COPY.programs.loadError;
    return apiError(message, 400, "BAD_REQUEST");
  }
}
