import { NextRequest } from "next/server";

import { apiError, apiOk } from "@/lib/api/route-response";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { Activity, ResumePrefillData } from "@/lib/types";

const TOKEN_PATTERN = /[0-9A-Za-z가-힣+#]+/g;
const PROGRAM_KEYWORD_BUDGET = 8;
const ACTIVITY_MATCH_THRESHOLD = 0.18;

function normalizeString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function normalizeList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeString(item))
      .filter(Boolean);
  }

  if (typeof value === "string") {
    return value
      .split(/[,\n/|]/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function tokenize(value: unknown): string[] {
  if (value == null) return [];

  const text =
    typeof value === "string"
      ? value
      : Array.isArray(value)
        ? value.join(" ")
        : String(value);

  const lowered = text.trim().toLowerCase();
  if (!lowered) return [];

  const matches = lowered.match(TOKEN_PATTERN) ?? [];
  return matches.filter((token) => {
    if (token.length < 2) return false;
    if (/^[가-힣]+$/.test(token) && token.length <= 2) return false;
    return true;
  });
}

function addWeightedTokens(
  store: Map<string, number>,
  value: unknown,
  weight: number
) {
  for (const token of tokenize(value)) {
    store.set(token, Math.max(store.get(token) ?? 0, weight));
  }
}

function uniqueStrings(values: Array<string | null | undefined>): string[] {
  return values.filter((value): value is string => Boolean(value && value.trim()));
}

function buildProgramKeywords(program: Record<string, unknown>) {
  const rawData =
    program.raw_data && typeof program.raw_data === "object"
      ? (program.raw_data as Record<string, unknown>)
      : {};
  const compareMeta =
    program.compare_meta && typeof program.compare_meta === "object"
      ? (program.compare_meta as Record<string, unknown>)
      : {};

  const store = new Map<string, number>();
  addWeightedTokens(store, program.skills, 1.6);
  addWeightedTokens(store, program.tags, 1.2);
  addWeightedTokens(store, program.target, 1.4);
  addWeightedTokens(store, rawData.target, 1.4);
  addWeightedTokens(store, rawData.target_text, 1.4);
  addWeightedTokens(store, compareMeta.target_job, 1.4);
  addWeightedTokens(store, program.category, 1.2);
  addWeightedTokens(store, program.title, 1.1);
  addWeightedTokens(store, program.summary, 0.9);
  addWeightedTokens(store, program.description, 0.8);
  addWeightedTokens(store, program.curriculum, 0.8);

  const keywordEntries = [...store.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  const keywordBudget = Math.max(
    1,
    keywordEntries
      .slice(0, PROGRAM_KEYWORD_BUDGET)
      .reduce((sum, [, weight]) => sum + weight, 0)
  );

  return { keywordEntries, keywordBudget, rawData, compareMeta };
}

function deriveTargetJob(
  program: Record<string, unknown>,
  compareMeta: Record<string, unknown>,
  keywordEntries: Array<[string, number]>
) {
  const explicitTarget = normalizeString(compareMeta.target_job);
  if (explicitTarget) return explicitTarget;

  const category = normalizeString(program.category);
  if (category && category !== "기타") return category;

  const target = normalizeList(program.target)[0];
  if (target) return target;

  const skill = normalizeList(program.skills)[0];
  if (skill) return skill;

  const title = normalizeString(program.title);
  if (title) return title;

  return keywordEntries[0]?.[0] ?? "";
}

function buildRequirementSummary(
  program: Record<string, unknown>,
  compareMeta: Record<string, unknown>,
  targetJob: string
) {
  const phrases = uniqueStrings([
    normalizeString(program.category),
    normalizeList(program.target).slice(0, 2).join(", "),
    normalizeList(program.skills).slice(0, 3).join(", "),
    normalizeString(compareMeta.target_job),
    normalizeString(program.summary),
  ]);

  if (phrases.length === 0 && targetJob) {
    return `${targetJob} 관련 요건을 기준으로 초안을 준비합니다.`;
  }

  return phrases.slice(0, 2).join(" / ");
}

function desiredSelectionCount(activityCount: number) {
  if (activityCount <= 0) return 0;
  if (activityCount <= 3) return activityCount;
  if (activityCount <= 6) return 4;
  return 5;
}

function scoreActivity(
  activity: Activity,
  keywordEntries: Array<[string, number]>,
  keywordBudget: number
) {
  const skillTokens = new Set(tokenize(activity.skills));
  const titleTokens = new Set(tokenize(activity.title));
  const bodyTokens = new Set(tokenize([activity.role, activity.description]));
  const matched = new Set<string>();
  let weightedHits = 0;

  for (const [keyword, weight] of keywordEntries) {
    if (skillTokens.has(keyword)) {
      matched.add(keyword);
      weightedHits += weight * 1.6;
      continue;
    }
    if (titleTokens.has(keyword)) {
      matched.add(keyword);
      weightedHits += weight * 1.2;
      continue;
    }
    if (bodyTokens.has(keyword)) {
      matched.add(keyword);
      weightedHits += weight * 0.9;
    }
  }

  return {
    activity,
    matchedKeywords: [...matched],
    score: Math.min(1, weightedHits / keywordBudget),
  };
}

function buildSummaryDraft(programTitle: string, targetJob: string, selectedCount: number) {
  const targetLabel = targetJob || "지원 프로그램";
  if (selectedCount > 0) {
    return `${programTitle} 지원을 위해 ${targetLabel}와 맞닿은 경험 ${selectedCount}건을 중심으로 이력서를 구성합니다.`;
  }
  return `${programTitle} 지원을 위해 ${targetLabel} 관점에서 이력서 초안을 정리합니다.`;
}

async function getAuthenticatedClient() {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw new Error("로그인이 필요합니다.");
  }

  return { supabase, user };
}

export async function GET(request: NextRequest) {
  try {
    const programId = request.nextUrl.searchParams.get("program_id")?.trim();
    if (!programId) {
      return apiError("program_id가 필요합니다.", 400, "BAD_REQUEST");
    }

    const { supabase, user } = await getAuthenticatedClient();
    const [{ data: programRow, error: programError }, { data: activityRows, error: activityError }] =
      await Promise.all([
        supabase.from("programs").select("*").eq("id", programId).maybeSingle(),
        supabase
          .from("activities")
          .select("*")
          .eq("user_id", user.id)
          .eq("is_visible", true)
          .order("created_at", { ascending: false }),
      ]);

    if (programError) {
      throw new Error(programError.message);
    }
    if (activityError) {
      throw new Error(activityError.message);
    }

    if (!programRow || programRow.is_active === false) {
      const prefill: ResumePrefillData = {
        status: "missing_program",
        program_id: programId,
        program_title: null,
        requirement_summary: "",
        target_job: "",
        summary: "",
        selected_activity_ids: [],
        auto_selected_activity_ids: [],
        message: "프로그램 정보를 찾지 못했어요. 수동으로 작성해주세요.",
        cta_href: null,
      };
      return apiOk({ prefill });
    }

    const program = programRow as Record<string, unknown>;
    const activities = ((activityRows as Activity[] | null) ?? []).map((activity) => ({
      ...activity,
      id: String(activity.id),
    }));
    const { keywordEntries, keywordBudget, compareMeta } = buildProgramKeywords(program);
    const targetJob = deriveTargetJob(program, compareMeta, keywordEntries);
    const requirementSummary = buildRequirementSummary(program, compareMeta, targetJob);
    const programTitle = normalizeString(program.title) || "선택한 프로그램";

    if (activities.length === 0) {
      const prefill: ResumePrefillData = {
        status: "no_activities",
        program_id: programId,
        program_title: programTitle,
        requirement_summary: requirementSummary,
        target_job: targetJob,
        summary: buildSummaryDraft(programTitle, targetJob, 0),
        selected_activity_ids: [],
        auto_selected_activity_ids: [],
        message: "관련 활동이 아직 없어요. 활동을 먼저 추가해보세요.",
        cta_href: "/dashboard/activities/new",
      };
      return apiOk({ prefill });
    }

    if (keywordEntries.length === 0) {
      const prefill: ResumePrefillData = {
        status: "insufficient_program",
        program_id: programId,
        program_title: programTitle,
        requirement_summary: requirementSummary || "요건 분석에 정보가 부족해요.",
        target_job: targetJob,
        summary: buildSummaryDraft(programTitle, targetJob, 0),
        selected_activity_ids: [],
        auto_selected_activity_ids: [],
        message: "요건 분석에 정보가 부족해요. 직무만 채워두고 수동으로 작성해주세요.",
        cta_href: null,
      };
      return apiOk({ prefill });
    }

    const rankedActivities = activities
      .map((activity) => scoreActivity(activity, keywordEntries, keywordBudget))
      .sort((a, b) => b.score - a.score || b.matchedKeywords.length - a.matchedKeywords.length);

    const selectedCount = desiredSelectionCount(activities.length);
    const matchedActivities = rankedActivities
      .filter((item) => item.score >= ACTIVITY_MATCH_THRESHOLD && item.matchedKeywords.length > 0)
      .slice(0, selectedCount);

    if (matchedActivities.length === 0) {
      const prefill: ResumePrefillData = {
        status: "low_relevance",
        program_id: programId,
        program_title: programTitle,
        requirement_summary: requirementSummary,
        target_job: targetJob,
        summary: buildSummaryDraft(programTitle, targetJob, 0),
        selected_activity_ids: [],
        auto_selected_activity_ids: [],
        message: "관련도가 낮아 자동 선택을 생략했습니다. 활동을 직접 골라주세요.",
        cta_href: null,
      };
      return apiOk({ prefill });
    }

    const selectedIds = matchedActivities.map((item) => item.activity.id);
    const prefill: ResumePrefillData = {
      status: "ready",
      program_id: programId,
      program_title: programTitle,
      requirement_summary: requirementSummary,
      target_job: targetJob,
      summary: buildSummaryDraft(programTitle, targetJob, matchedActivities.length),
      selected_activity_ids: selectedIds,
      auto_selected_activity_ids: selectedIds,
      message: `${programTitle} 지원용 이력서 초안을 준비했습니다.`,
      cta_href: null,
    };

    return apiOk({ prefill });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "이력서 프리필 데이터를 불러오지 못했습니다.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}
