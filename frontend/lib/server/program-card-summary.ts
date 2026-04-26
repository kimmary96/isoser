import type { CompareMeta, ProgramCardSummary } from "@/lib/types";

type SupabaseErrorLike = {
  code?: string | null;
  message?: string | null;
} | null | undefined;

type SupabaseRouteClient = {
  from: (table: string) => {
    select: (columns: string) => {
      in: (
        column: string,
        values: string[],
      ) => PromiseLike<{
        data: Record<string, unknown>[] | null;
        error: SupabaseErrorLike;
      }>;
    };
  };
};

export type ProgramCardRouteClient = SupabaseRouteClient;

type SupabaseDeadlineRouteClient = {
  from: (table: string) => {
    select: (columns: string) => {
      eq: (
        column: string,
        value: boolean | string | number,
      ) => {
        order: (
          column: string,
          options: { ascending: boolean; nullsFirst?: boolean },
        ) => {
          limit: (count: number) => PromiseLike<{
            data: Record<string, unknown>[] | null;
            error: SupabaseErrorLike;
          }>;
        };
      };
      gte: (
        column: string,
        value: string,
      ) => {
        order: (
          column: string,
          options: { ascending: boolean; nullsFirst?: boolean },
        ) => {
          limit: (count: number) => PromiseLike<{
            data: Record<string, unknown>[] | null;
            error: SupabaseErrorLike;
          }>;
        };
      };
    };
  };
};

export type ProgramCardDeadlineRouteClient = SupabaseDeadlineRouteClient;

function cleanText(value: unknown): string | null {
  const text = String(value ?? "").trim();
  return text || null;
}

function asStringArray(value: unknown): string[] | null {
  if (!Array.isArray(value)) {
    return null;
  }

  const items = value
    .map((item) => cleanText(item))
    .filter((item): item is string => Boolean(item));
  return items.length > 0 ? items : null;
}

function asNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function asBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asCompareMeta(value: unknown): CompareMeta | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  return value as CompareMeta;
}

function supportAmountValue(row: Record<string, unknown>): number | string | null {
  if (
    typeof row.verified_self_pay_amount === "number" ||
    typeof row.verified_self_pay_amount === "string"
  ) {
    return row.verified_self_pay_amount as number | string;
  }
  if (typeof row.support_amount === "number" || typeof row.support_amount === "string") {
    return row.support_amount as number | string;
  }
  if (typeof row.subsidy_amount === "number" || typeof row.subsidy_amount === "string") {
    return row.subsidy_amount as number | string;
  }
  return null;
}

function normalizeProgramIds(programIds: string[]): string[] {
  const seen = new Set<string>();
  const orderedIds: string[] = [];

  for (const programId of programIds) {
    const normalized = String(programId || "").trim();
    if (!normalized || seen.has(normalized)) {
      continue;
    }
    seen.add(normalized);
    orderedIds.push(normalized);
  }

  return orderedIds;
}

function isIgnorableProgramListIndexError(error: SupabaseErrorLike): boolean {
  if (!error) {
    return false;
  }

  const code = String(error.code ?? "").toUpperCase();
  const message = String(error.message ?? "").toLowerCase();
  return (
    code === "42P01" ||
    code === "42703" ||
    code === "PGRST202" ||
    message.includes("program_list_index")
  );
}

function toExternalLink(value: unknown): string | null {
  const text = cleanText(value);
  if (!text) {
    return null;
  }
  return /^https?:\/\//i.test(text) ? text : null;
}

export function readModelRowToProgramCardSummary(row: Record<string, unknown>): ProgramCardSummary | null {
  const id = cleanText(row.id);
  if (!id) {
    return null;
  }

  const primaryLink = cleanText(row.primary_link) ?? cleanText(row.application_url);
  const externalDetailLink = toExternalLink(row.link);

  return {
    id,
    title: cleanText(row.title),
    category: cleanText(row.category),
    category_detail: cleanText(row.category_detail),
    location: cleanText(row.location_label) ?? cleanText(row.location) ?? cleanText(row.region_label),
    provider: cleanText(row.provider_name) ?? cleanText(row.provider),
    source: cleanText(row.source_label) ?? cleanText(row.source),
    source_url: cleanText(row.source_url) ?? primaryLink,
    link: externalDetailLink,
    deadline: cleanText(row.application_end_date) ?? cleanText(row.deadline) ?? cleanText(row.close_date),
    start_date: cleanText(row.program_start_date) ?? cleanText(row.start_date),
    end_date: cleanText(row.program_end_date) ?? cleanText(row.end_date),
    cost:
      typeof row.cost === "number" || typeof row.cost === "string"
        ? (row.cost as number | string)
        : null,
    support_amount: supportAmountValue(row),
    verified_self_pay_amount:
      typeof row.verified_self_pay_amount === "number" ||
      typeof row.verified_self_pay_amount === "string"
        ? (row.verified_self_pay_amount as number | string)
        : null,
    cost_type: cleanText(row.cost_type),
    support_type: cleanText(row.support_type),
    teaching_method: cleanText(row.teaching_method_label) ?? cleanText(row.teaching_method),
    is_active: asBoolean(row.is_active),
    is_ad: asBoolean(row.is_ad),
    days_left: asNumber(row.days_left),
    deadline_confidence:
      cleanText(row.deadline_confidence) as ProgramCardSummary["deadline_confidence"],
    summary: cleanText(row.summary_text) ?? cleanText(row.summary),
    description: cleanText(row.description),
    compare_meta: asCompareMeta(row.compare_meta),
    tags: asStringArray(row.badge_labels) ?? asStringArray(row.tags),
    skills: asStringArray(row.keyword_labels) ?? asStringArray(row.skills),
    application_url: primaryLink,
    application_method: cleanText(row.application_method),
    participation_time:
      cleanText(row.program_period_label) ?? cleanText(row.participation_time),
    subsidy_amount: supportAmountValue(row),
    display_categories: asStringArray(row.display_categories),
    participation_mode_label:
      cleanText(row.recruiting_status_label) ?? cleanText(row.participation_mode_label),
    participation_time_text:
      cleanText(row.participation_label) ?? cleanText(row.participation_time_text),
    selection_process_label: cleanText(row.selection_process_label),
    extracted_keywords: asStringArray(row.extracted_keywords) ?? asStringArray(row.keyword_labels),
    rating:
      typeof row.rating === "number" || typeof row.rating === "string"
        ? (row.rating as number | string)
        : null,
    rating_raw:
      typeof row.rating_raw === "number" || typeof row.rating_raw === "string"
        ? (row.rating_raw as number | string)
        : null,
    rating_normalized: asNumber(row.rating_normalized),
    rating_scale: asNumber(row.rating_scale),
    rating_display: cleanText(row.rating_display),
    review_count: asNumber(row.review_count),
    relevance_score: asNumber(row.relevance_score),
    final_score: asNumber(row.final_score),
    urgency_score: asNumber(row.urgency_score),
    recommended_score: asNumber(row.recommended_score),
    recommendation_reasons: asStringArray(row.recommendation_reasons),
    detail_view_count: asNumber(row.detail_view_count),
    detail_view_count_7d: asNumber(row.detail_view_count_7d),
    click_hotness_score: asNumber(row.click_hotness_score),
    last_detail_viewed_at: cleanText(row.last_detail_viewed_at),
    promoted_rank: asNumber(row.promoted_rank),
  };
}

export function legacyProgramRowToProgramCardSummary(row: Record<string, unknown>): ProgramCardSummary | null {
  const id = cleanText(row.id);
  if (!id) {
    return null;
  }

  const applicationUrl = cleanText(row.application_url);
  const sourceUrl = cleanText(row.source_url);
  const link = toExternalLink(row.link);

  return {
    id,
    title: cleanText(row.title),
    category: cleanText(row.category),
    category_detail: cleanText(row.category_detail),
    location: cleanText(row.location),
    provider: cleanText(row.provider),
    source: cleanText(row.source),
    source_url: sourceUrl ?? applicationUrl,
    link,
    deadline: cleanText(row.deadline),
    start_date: cleanText(row.start_date),
    end_date: cleanText(row.end_date),
    cost:
      typeof row.cost === "number" || typeof row.cost === "string"
        ? (row.cost as number | string)
        : null,
    support_amount: supportAmountValue(row),
    verified_self_pay_amount:
      typeof row.verified_self_pay_amount === "number" ||
      typeof row.verified_self_pay_amount === "string"
        ? (row.verified_self_pay_amount as number | string)
        : null,
    cost_type: cleanText(row.cost_type),
    support_type: cleanText(row.support_type),
    teaching_method: cleanText(row.teaching_method),
    is_active: asBoolean(row.is_active),
    is_ad: asBoolean(row.is_ad),
    days_left: asNumber(row.days_left),
    deadline_confidence:
      cleanText(row.deadline_confidence) as ProgramCardSummary["deadline_confidence"],
    summary: cleanText(row.summary),
    description: cleanText(row.description),
    compare_meta: asCompareMeta(row.compare_meta),
    tags: asStringArray(row.tags),
    skills: asStringArray(row.skills),
    application_url: applicationUrl,
    application_method: cleanText(row.application_method),
    participation_time: cleanText(row.participation_time),
    subsidy_amount: supportAmountValue(row),
    display_categories: asStringArray(row.display_categories),
    participation_mode_label: cleanText(row.participation_mode_label),
    participation_time_text: cleanText(row.participation_time_text),
    selection_process_label: cleanText(row.selection_process_label),
    extracted_keywords: asStringArray(row.extracted_keywords),
    rating:
      typeof row.rating === "number" || typeof row.rating === "string"
        ? (row.rating as number | string)
        : null,
    rating_raw:
      typeof row.rating_raw === "number" || typeof row.rating_raw === "string"
        ? (row.rating_raw as number | string)
        : null,
    rating_normalized: asNumber(row.rating_normalized),
    rating_scale: asNumber(row.rating_scale),
    rating_display: cleanText(row.rating_display),
    review_count: asNumber(row.review_count),
    relevance_score: asNumber(row.relevance_score),
    final_score: asNumber(row.final_score),
    urgency_score: asNumber(row.urgency_score),
    recommended_score: asNumber(row.recommended_score),
    recommendation_reasons: asStringArray(row.recommendation_reasons),
    detail_view_count: asNumber(row.detail_view_count),
    detail_view_count_7d: asNumber(row.detail_view_count_7d),
    click_hotness_score: asNumber(row.click_hotness_score),
    last_detail_viewed_at: cleanText(row.last_detail_viewed_at),
    promoted_rank: asNumber(row.promoted_rank),
  };
}

export async function loadProgramCardSummariesByIds(
  supabase: SupabaseRouteClient,
  programIds: string[],
): Promise<ProgramCardSummary[]> {
  const orderedIds = normalizeProgramIds(programIds);
  if (orderedIds.length === 0) {
    return [];
  }

  const readModelMap = new Map<string, ProgramCardSummary>();
  let missingIds = orderedIds;

  try {
    const { data, error } = await supabase
      .from("program_list_index")
      .select("*")
      .in("id", orderedIds);

    if (error) {
      if (!isIgnorableProgramListIndexError(error)) {
        throw new Error(error.message || "program_list_index 조회에 실패했습니다.");
      }
    } else {
      for (const row of data ?? []) {
        const summary = readModelRowToProgramCardSummary(row);
        if (!summary) {
          continue;
        }
        readModelMap.set(String(summary.id), summary);
      }
      missingIds = orderedIds.filter((programId) => !readModelMap.has(programId));
    }
  } catch (error) {
    if (!isIgnorableProgramListIndexError(error as SupabaseErrorLike)) {
      throw error;
    }
  }

  const legacyProgramMap = new Map<string, ProgramCardSummary>();
  if (missingIds.length > 0) {
    const { data, error } = await supabase
      .from("programs")
      .select("*")
      .in("id", missingIds);

    if (error) {
      throw new Error(error.message || "programs 조회에 실패했습니다.");
    }

    for (const row of data ?? []) {
      const summary = legacyProgramRowToProgramCardSummary(row);
      if (!summary) {
        continue;
      }
      legacyProgramMap.set(String(summary.id), summary);
    }
  }

  return orderedIds
    .map((programId) => readModelMap.get(programId) ?? legacyProgramMap.get(programId) ?? null)
    .filter((program): program is ProgramCardSummary => Boolean(program));
}

export async function loadDeadlineOrderedProgramCardSummaries(
  supabase: SupabaseDeadlineRouteClient,
  options: {
    today: string;
    limit: number;
  },
): Promise<ProgramCardSummary[]> {
  const { today, limit } = options;
  const normalizedLimit = Math.max(1, limit);

  try {
    const { data, error } = await supabase
      .from("program_list_index")
      .select("*")
      .eq("is_open", true)
      .order("deadline", { ascending: true, nullsFirst: false })
      .limit(normalizedLimit);

    if (error) {
      if (!isIgnorableProgramListIndexError(error)) {
        throw new Error(error.message || "program_list_index 조회에 실패했습니다.");
      }
    } else {
      return (data ?? [])
        .map((row) => readModelRowToProgramCardSummary(row))
        .filter((program): program is ProgramCardSummary => Boolean(program));
    }
  } catch (error) {
    if (!isIgnorableProgramListIndexError(error as SupabaseErrorLike)) {
      throw error;
    }
  }

  const { data, error } = await supabase
    .from("programs")
    .select("*")
    .gte("deadline", today)
    .order("deadline", { ascending: true, nullsFirst: false })
    .limit(normalizedLimit);

  if (error) {
    throw new Error(error.message || "programs 조회에 실패했습니다.");
  }

  return (data ?? [])
    .map((row) => legacyProgramRowToProgramCardSummary(row))
    .filter((program): program is ProgramCardSummary => Boolean(program));
}
