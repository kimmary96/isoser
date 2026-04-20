import { NextRequest } from "next/server";

import { apiError, apiOk, apiRateLimited } from "@/lib/api/route-response";
import { enforceRateLimit } from "@/lib/server/rate-limit";
import { createServerSupabaseClient } from "@/lib/supabase/server";
import type { MatchResult } from "@/lib/types";

type ResumeOption = {
  id: string;
  title: string;
  target_job: string | null;
  selected_activity_ids: string[] | null;
  created_at: string;
};

type SavedAnalysisCard = {
  id: string;
  job_title: string;
  job_posting: string;
  total_score: number;
  grade: string;
  summary: string;
  created_at: string;
  result: MatchResult | null;
};

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

async function loadSavedAnalysesAndResumes() {
  const { supabase, user } = await getAuthenticatedClient();

  const [analysisResult, resumeResult] = await Promise.all([
    supabase
      .from("match_analyses")
      .select("id, job_title, job_posting, total_score, grade, summary, created_at, analysis_payload")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30),
    supabase
      .from("resumes")
      .select("id, title, target_job, selected_activity_ids, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  let analysisRows: Array<Record<string, unknown>> = [];

  if (analysisResult.error && analysisResult.error.code === "42703") {
    const fallback = await supabase
      .from("match_analyses")
      .select("id, job_title, job_posting, total_score, grade, summary, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);

    if (fallback.error) throw new Error(fallback.error.message);
    analysisRows = (fallback.data as Array<Record<string, unknown>> | null) ?? [];
  } else if (analysisResult.error) {
    throw new Error(analysisResult.error.message);
  } else {
    analysisRows = (analysisResult.data as Array<Record<string, unknown>> | null) ?? [];
  }

  if (resumeResult.error) throw new Error(resumeResult.error.message);

  const savedAnalyses: SavedAnalysisCard[] = analysisRows.map((row) => ({
    id: String(row.id ?? ""),
    job_title: String(row.job_title ?? "제목 미지정 공고"),
    job_posting: String(row.job_posting ?? ""),
    total_score: Number(row.total_score ?? 0),
    grade: String(row.grade ?? "-"),
    summary: String(row.summary ?? ""),
    created_at: String(row.created_at ?? ""),
    result: (row.analysis_payload as MatchResult | null) ?? null,
  }));

  return {
    supabase,
    user,
    savedAnalyses,
    resumeOptions: ((resumeResult.data as ResumeOption[] | null) ?? []),
  };
}

export async function GET() {
  try {
    const { savedAnalyses, resumeOptions } = await loadSavedAnalysesAndResumes();
    return apiOk({ savedAnalyses, resumeOptions });
  } catch (error) {
    const message = error instanceof Error ? error.message : "분석 데이터를 불러오지 못했습니다.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}

export async function POST(request: NextRequest) {
  try {
    const { supabase, user } = await getAuthenticatedClient();
    const rateLimit = enforceRateLimit({
      namespace: "match-analysis",
      key: user.id,
      maxRequests: 6,
      windowMs: 60_000,
    });
    if (!rateLimit.allowed) {
      return apiRateLimited(
        "분석 요청이 너무 많습니다. 잠시 후 다시 시도해주세요.",
        rateLimit.retryAfterSeconds
      );
    }

    const body = (await request.json()) as {
      companyName?: string;
      positionName?: string;
      jobPosting?: string;
      analysisMode?: "resume" | "activity";
      selectedResumeId?: string;
    };

    const companyName = body.companyName?.trim() ?? "";
    const positionName = body.positionName?.trim() ?? "";
    const jobPosting = body.jobPosting?.trim() ?? "";
    const analysisMode = body.analysisMode;

    if (!companyName || !positionName || !jobPosting || !analysisMode) {
      return apiError("분석 요청이 올바르지 않습니다.", 400, "BAD_REQUEST");
    }
    if (analysisMode === "resume" && !body.selectedResumeId) {
      return apiError("분석할 이력서를 선택해 주세요.", 400, "BAD_REQUEST");
    }

    const [
      { data: activityData, error: activityError },
      { data: profileData, error: profileError },
    ] = await Promise.all([
      supabase
        .from("activities")
        .select("id, title, description")
        .eq("is_visible", true)
        .eq("user_id", user.id),
      supabase
        .from("profiles")
        .select("name, education, career, education_history, awards, certifications, languages, skills, self_intro")
        .eq("id", user.id)
        .maybeSingle(),
    ]);

    if (activityError) throw new Error(activityError.message);
    if (profileError) throw new Error(profileError.message);

    const allActivities = activityData || [];
    let selectedActivities = allActivities;

    if (analysisMode === "resume") {
      const { data: resume, error: resumeError } = await supabase
        .from("resumes")
        .select("id, selected_activity_ids")
        .eq("id", body.selectedResumeId)
        .eq("user_id", user.id)
        .maybeSingle();

      if (resumeError) throw new Error(resumeError.message);
      if (!resume) throw new Error("선택한 이력서 정보를 찾지 못했습니다.");

      const selectedIds = new Set(resume.selected_activity_ids ?? []);
      selectedActivities = allActivities.filter((item) => selectedIds.has(item.id));
      if (selectedActivities.length === 0) {
        throw new Error("선택한 이력서에 연결된 활동이 없습니다.");
      }
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:8000";
    const analyzeResponse = await fetch(`${backendUrl}/match/analyze`, {
      signal: AbortSignal.timeout(30_000),
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        job_posting: jobPosting,
        activities: selectedActivities,
        profile_context: {
          name: profileData?.name ?? undefined,
          education: profileData?.education ?? undefined,
          career: profileData?.career ?? [],
          education_history: profileData?.education_history ?? [],
          awards: profileData?.awards ?? [],
          certifications: profileData?.certifications ?? [],
          languages: profileData?.languages ?? [],
          skills: profileData?.skills ?? [],
          self_intro: profileData?.self_intro ?? "",
        },
      }),
    });

    if (!analyzeResponse.ok) {
      const errorData = await analyzeResponse.json().catch(() => null);
      throw new Error(errorData?.detail || "합격률 분석에 실패했습니다.");
    }

    const matchResult = (await analyzeResponse.json()) as MatchResult;
    const jobTitle = `${companyName} ${positionName}`.trim();

    const insertPayload = {
      user_id: user.id,
      job_title: jobTitle,
      job_posting: jobPosting,
      total_score: matchResult.total_score,
      grade: matchResult.grade,
      summary: matchResult.summary,
      matched_keywords: matchResult.matched_keywords ?? [],
      missing_keywords: matchResult.missing_keywords ?? [],
      recommended_activities: matchResult.recommended_activities ?? [],
      analysis_payload: matchResult,
    };

    let insertedId = "";
    const insertResult = await supabase
      .from("match_analyses")
      .insert(insertPayload)
      .select("id, created_at")
      .single();

    if (insertResult.error?.code === "42703") {
      const fallbackInsert = await supabase
        .from("match_analyses")
        .insert({
          user_id: user.id,
          job_title: jobTitle,
          job_posting: jobPosting,
          total_score: matchResult.total_score,
          grade: matchResult.grade,
          summary: matchResult.summary,
          matched_keywords: matchResult.matched_keywords ?? [],
          missing_keywords: matchResult.missing_keywords ?? [],
          recommended_activities: matchResult.recommended_activities ?? [],
        })
        .select("id, created_at")
        .single();

      if (fallbackInsert.error || !fallbackInsert.data) {
        throw new Error(fallbackInsert.error?.message ?? "분석 저장에 실패했습니다.");
      }
      insertedId = fallbackInsert.data.id;
      return apiOk({
        analysis: {
          id: insertedId,
          job_title: jobTitle,
          job_posting: jobPosting,
          total_score: matchResult.total_score,
          grade: matchResult.grade,
          summary: matchResult.summary,
          created_at: fallbackInsert.data.created_at,
          result: null,
        },
      });
    }

    if (insertResult.error || !insertResult.data) {
      throw new Error(insertResult.error?.message ?? "분석 저장에 실패했습니다.");
    }

    insertedId = insertResult.data.id;
    return apiOk({
      analysis: {
        id: insertedId,
        job_title: jobTitle,
        job_posting: jobPosting,
        total_score: matchResult.total_score,
        grade: matchResult.grade,
        summary: matchResult.summary,
        created_at: insertResult.data.created_at,
        result: matchResult,
      },
    });
  } catch (error) {
    if (error instanceof Error && error.name === "TimeoutError") {
      return apiError("합격률 분석 응답이 지연되고 있습니다. 잠시 후 다시 시도해주세요.", 504, "UPSTREAM_ERROR");
    }
    const message = error instanceof Error ? error.message : "합격률 분석에 실패했습니다.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const id = request.nextUrl.searchParams.get("id")?.trim();
    if (!id) {
      return apiError("삭제할 분석 ID가 필요합니다.", 400, "BAD_REQUEST");
    }

    const { supabase, user } = await getAuthenticatedClient();
    const { data, error } = await supabase
      .from("match_analyses")
      .delete()
      .eq("id", id)
      .eq("user_id", user.id)
      .select("id");

    if (error) throw new Error(error.message);
    if (!data || data.length === 0) {
      throw new Error("삭제 권한이 없어 DB에서 삭제되지 않았습니다.");
    }

    return apiOk({ id });
  } catch (error) {
    const message = error instanceof Error ? error.message : "분석 삭제에 실패했습니다.";
    return apiError(message, 400, "BAD_REQUEST");
  }
}
