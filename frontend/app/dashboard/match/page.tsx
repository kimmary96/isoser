"use client";

import { useEffect, useMemo, useState } from "react";

import { analyzeMatch, extractJobImage } from "@/lib/api/backend";
import { getGuestActivities, isGuestMode } from "@/lib/guest";
import { createBrowserClient } from "@/lib/supabase/client";
import type { MatchResult } from "@/lib/types";

type DetailedScore = {
  key: string;
  label: string;
  score: number;
  max_score: number;
  grade: string;
  reason: string;
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

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function makeJobTitle(company: string, position: string): string {
  const c = company.trim();
  const p = position.trim();
  if (c && p) return `${c} ${p}`;
  if (c) return c;
  if (p) return p;
  return "제목 미지정 공고";
}

function inferCompanySignals(jobTitle: string, jobPosting: string) {
  const text = `${jobTitle} ${jobPosting}`.toLowerCase();

  let stability = 55;
  if (/(상장|코스피|코스닥|흑자|영업이익|매출 성장|series c|series d)/.test(text)) stability += 20;
  if (/(스타트업|seed|series a|적자|구조조정|자금난)/.test(text)) stability -= 20;
  stability = Math.max(20, Math.min(90, stability));

  let regularRate = 45;
  if (/(정규직 전환|전환형 인턴|인턴 후 정규직|전환 가능)/.test(text)) regularRate += 25;
  if (/(계약직|파견|프리랜서|단기)/.test(text)) regularRate -= 20;
  regularRate = Math.max(10, Math.min(90, regularRate));

  const employmentSignal = /(정규직|무기계약)/.test(text)
    ? "정규직 중심"
    : /(계약직|파견|프리랜서)/.test(text)
      ? "비정규 계약 포함"
      : "공고 내 고용형태 정보 제한적";

  return { stability, regularRate, employmentSignal };
}

function ResultDetail({
  result,
  jobTitle,
  jobPosting,
}: {
  result: MatchResult;
  jobTitle: string;
  jobPosting: string;
}) {
  const detailedScores = (result?.detailed_scores ?? []) as DetailedScore[];
  const signals = inferCompanySignals(jobTitle, jobPosting);

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-slate-900 p-5 text-white">
        <p className="text-sm text-slate-300">매칭 점수</p>
        <div className="mt-2 flex items-end gap-2">
          <p className="text-5xl font-bold">{result.total_score}</p>
          <p className="pb-1 text-lg text-slate-300">/ 100</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">등급 {result.grade}</span>
          <span className="rounded-full bg-cyan-400/20 px-3 py-1 text-xs font-semibold text-cyan-100">
            {result.support_recommendation}
          </span>
        </div>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-sm font-semibold text-gray-800">한 줄 총평</p>
        <p className="mt-2 text-sm leading-6 text-gray-700">{result.summary}</p>
      </section>

      {detailedScores.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-gray-800">매칭 점수 상세</p>
          <div className="space-y-3">
            {detailedScores.map((item) => (
              <div key={item.key} className="rounded-lg border border-gray-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                    <p className="mt-1 text-xs leading-5 text-gray-500">{item.reason}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-gray-900">
                      {item.score} / {item.max_score}
                    </p>
                    <span className="mt-1 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {item.grade}
                    </span>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-black"
                    style={{ width: `${(item.score / item.max_score) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {(result.matched_keywords?.length > 0 || result.missing_keywords?.length > 0) && (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {result.matched_keywords?.length > 0 && (
            <div className="rounded-xl border border-green-100 bg-green-50 p-4">
              <p className="text-xs font-semibold text-green-700">보유 키워드</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {result.matched_keywords.map((kw) => (
                  <span key={kw} className="rounded bg-white px-2 py-0.5 text-xs text-green-800">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {result.missing_keywords?.length > 0 && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-4">
              <p className="text-xs font-semibold text-red-700">보완 키워드</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {result.missing_keywords.map((kw) => (
                  <span key={kw} className="rounded bg-white px-2 py-0.5 text-xs text-red-800">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <section className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-indigo-900">기업 정보 요약 (베타)</p>
          <span className="rounded bg-white px-2 py-0.5 text-[11px] text-indigo-700">공고 텍스트 기반 추정</span>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-lg bg-white p-3">
            <p className="text-xs text-gray-500">재무/사업 안정성 신호</p>
            <p className="mt-1 text-xl font-bold text-gray-900">{signals.stability}점</p>
          </div>
          <div className="rounded-lg bg-white p-3">
            <p className="text-xs text-gray-500">정규직 전환 가능성 신호</p>
            <p className="mt-1 text-xl font-bold text-gray-900">{signals.regularRate}%</p>
          </div>
          <div className="rounded-lg bg-white p-3">
            <p className="text-xs text-gray-500">고용 형태</p>
            <p className="mt-1 text-sm font-semibold text-gray-900">{signals.employmentSignal}</p>
          </div>
        </div>

        <p className="mt-3 text-xs leading-5 text-gray-600">
          실제 재무제표/공시 기반 수치가 아니며, 지원 전 기업 공시/리뷰/뉴스를 함께 확인하는 것을 권장합니다.
        </p>
      </section>
    </div>
  );
}

export default function MatchPage() {
  const supabase = useMemo(() => createBrowserClient(), []);

  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysisCard[]>([]);
  const [selectedAnalysis, setSelectedAnalysis] = useState<SavedAnalysisCard | null>(null);

  const [showInputModal, setShowInputModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const [companyName, setCompanyName] = useState("");
  const [positionName, setPositionName] = useState("");
  const [jobPosting, setJobPosting] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);

  const [loadingList, setLoadingList] = useState(false);
  const [loadingAnalyze, setLoadingAnalyze] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saveNotice, setSaveNotice] = useState<string | null>(null);

  const loadSavedAnalyses = async () => {
    if (isGuestMode()) {
      setSavedAnalyses([]);
      return;
    }

    setLoadingList(true);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        setSavedAnalyses([]);
        return;
      }

      const withPayload = await supabase
        .from("match_analyses")
        .select("id, job_title, job_posting, total_score, grade, summary, created_at, analysis_payload")
        .eq("user_id", authData.user.id)
        .order("created_at", { ascending: false })
        .limit(30);

      let rows: Array<Record<string, unknown>> = [];

      if (withPayload.error && withPayload.error.code === "42703") {
        const withoutPayload = await supabase
          .from("match_analyses")
          .select("id, job_title, job_posting, total_score, grade, summary, created_at")
          .eq("user_id", authData.user.id)
          .order("created_at", { ascending: false })
          .limit(30);

        if (withoutPayload.error) {
          setSavedAnalyses([]);
          return;
        }

        rows = (withoutPayload.data as Array<Record<string, unknown>> | null) ?? [];
      } else if (withPayload.error) {
        setSavedAnalyses([]);
        return;
      } else {
        rows = (withPayload.data as Array<Record<string, unknown>> | null) ?? [];
      }
      const mapped: SavedAnalysisCard[] = rows.map((row) => ({
        id: String(row.id ?? ""),
        job_title: String(row.job_title ?? "제목 미지정 공고"),
        job_posting: String(row.job_posting ?? ""),
        total_score: Number(row.total_score ?? 0),
        grade: String(row.grade ?? "-"),
        summary: String(row.summary ?? ""),
        created_at: String(row.created_at ?? ""),
        result: (row.analysis_payload as MatchResult | null) ?? null,
      }));

      setSavedAnalyses(mapped);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadSavedAnalyses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleExtractImage = async () => {
    if (!imageFile) {
      setError("먼저 이미지 파일을 선택해 주세요.");
      return;
    }

    setExtracting(true);
    setError(null);

    try {
      const extracted = await extractJobImage(imageFile);
      const extractedText = extracted?.job_posting_text || "";

      if (!extractedText.trim()) {
        throw new Error("이미지에서 추출된 공고 텍스트가 비어 있습니다.");
      }

      setJobPosting(extractedText);
    } catch (err) {
      setError(err instanceof Error ? err.message : "이미지 공고 추출 중 오류가 발생했습니다.");
    } finally {
      setExtracting(false);
    }
  };

  const handleAnalyze = async () => {
    if (!jobPosting.trim()) {
      setError("공고 전문을 입력해 주세요.");
      return;
    }

    setLoadingAnalyze(true);
    setError(null);
    setSaveNotice(null);

    try {
      let activities: { id: string; title: string; description: string | null }[] = [];
      let profileContext: {
        name?: string;
        education?: string;
        career?: string[];
        education_history?: string[];
        awards?: string[];
        certifications?: string[];
        languages?: string[];
        skills?: string[];
        self_intro?: string;
      } = {};

      if (isGuestMode()) {
        activities = getGuestActivities().map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description,
        }));

        profileContext = {
          name: "게스트 사용자",
          education: "게스트 모드",
          career: ["게스트 QA 경력"],
          education_history: ["게스트 학력"],
          awards: [],
          certifications: [],
          languages: ["한국어"],
          skills: ["Next.js", "FastAPI"],
          self_intro: "게스트 모드 프로필",
        };
      } else {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError || !authData.user) {
          throw new Error("로그인이 필요합니다.");
        }

        const [
          { data: activityData, error: activityError },
          { data: profileData, error: profileError },
        ] = await Promise.all([
          supabase.from("activities").select("id, title, description").eq("is_visible", true),
          supabase
            .from("profiles")
            .select("name, education, career, education_history, awards, certifications, languages, skills, self_intro")
            .eq("id", authData.user.id)
            .maybeSingle(),
        ]);

        if (activityError) throw new Error(activityError.message);
        if (profileError) throw new Error(profileError.message);

        activities = activityData || [];
        profileContext = {
          name: profileData?.name ?? undefined,
          education: profileData?.education ?? undefined,
          career: profileData?.career ?? [],
          education_history: profileData?.education_history ?? [],
          awards: profileData?.awards ?? [],
          certifications: profileData?.certifications ?? [],
          languages: profileData?.languages ?? [],
          skills: profileData?.skills ?? [],
          self_intro: profileData?.self_intro ?? "",
        };
      }

      const matchResult = await analyzeMatch({
        job_posting: jobPosting,
        activities,
        profile_context: profileContext,
      });

      const jobTitle = makeJobTitle(companyName, positionName);

      if (!isGuestMode()) {
        const { data: authData, error: authError } = await supabase.auth.getUser();

        if (!authError && authData?.user) {
          const { error: saveError } = await supabase.from("match_analyses").insert({
            user_id: authData.user.id,
            job_title: jobTitle,
            job_posting: jobPosting.trim(),
            total_score: matchResult.total_score,
            grade: matchResult.grade,
            summary: matchResult.summary,
            matched_keywords: matchResult.matched_keywords ?? [],
            missing_keywords: matchResult.missing_keywords ?? [],
            recommended_activities: matchResult.recommended_activities ?? [],
            analysis_payload: matchResult,
          });

          if (saveError?.code === "42703") {
            await supabase.from("match_analyses").insert({
              user_id: authData.user.id,
              job_title: jobTitle,
              job_posting: jobPosting.trim(),
              total_score: matchResult.total_score,
              grade: matchResult.grade,
              summary: matchResult.summary,
              matched_keywords: matchResult.matched_keywords ?? [],
              missing_keywords: matchResult.missing_keywords ?? [],
              recommended_activities: matchResult.recommended_activities ?? [],
            });
          }
        }
      }

      await loadSavedAnalyses();

      const newItem: SavedAnalysisCard = {
        id: `tmp-${Date.now()}`,
        job_title: jobTitle,
        job_posting: jobPosting,
        total_score: matchResult.total_score,
        grade: matchResult.grade,
        summary: matchResult.summary,
        created_at: new Date().toISOString(),
        result: matchResult,
      };

      setSelectedAnalysis(newItem);
      setShowDetailModal(true);
      setShowInputModal(false);
      setSaveNotice("분석이 완료되어 저장되었습니다.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "분석 중 오류가 발생했습니다.");
    } finally {
      setLoadingAnalyze(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">합격률 분석하기</h1>
            <p className="mt-1 text-sm text-gray-500">관심 있는 공고의 합격 확률을 지금 확인해보세요.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              setCompanyName("");
              setPositionName("");
              setJobPosting("");
              setImageFile(null);
              setError(null);
              setSaveNotice(null);
              setShowInputModal(true);
            }}
            className="rounded-lg bg-black px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800"
          >
            합격률 분석하기
          </button>
        </div>

        {saveNotice && <p className="mb-4 text-sm text-gray-600">{saveNotice}</p>}

        {loadingList ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">저장된 분석을 불러오는 중...</div>
        ) : savedAnalyses.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-sm text-gray-400">
            아직 저장된 분석이 없습니다. 우측 상단의 "합격률 분석하기" 버튼으로 첫 분석을 시작해보세요.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {savedAnalyses.map((item) => (
              <button
                type="button"
                key={item.id}
                onClick={() => {
                  setSelectedAnalysis(item);
                  setShowDetailModal(true);
                }}
                className="rounded-2xl border border-gray-200 bg-white p-5 text-left transition-shadow hover:shadow-md"
              >
                <p className="text-4xl font-bold text-sky-500">{item.total_score}<span className="text-2xl">점</span></p>
                <p className="mt-3 line-clamp-2 text-xl font-semibold text-gray-900">{item.job_title}</p>
                <p className="mt-1 text-sm text-gray-500">등급 {item.grade}</p>
                <p className="mt-8 text-sm text-gray-400">{formatDateTime(item.created_at)}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {showInputModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-2xl font-bold text-gray-900">공고 입력</h2>
              <button
                type="button"
                onClick={() => setShowInputModal(false)}
                className="rounded-md px-2 py-1 text-2xl text-gray-500 hover:bg-gray-100"
                aria-label="닫기"
              >
                ×
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <section className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-semibold text-gray-800">1. 회사명과 직무명 입력</p>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <input
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder="회사명을 입력해 주세요"
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                  />
                  <input
                    value={positionName}
                    onChange={(e) => setPositionName(e.target.value)}
                    placeholder="직무명을 입력해 주세요"
                    className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                  />
                </div>
              </section>

              <section className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-semibold text-gray-800">2. 공고 업로드</p>
                <div className="mt-3 space-y-3">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={(e) => setImageFile(e.target.files?.[0] ?? null)}
                    className="block w-full text-sm text-gray-700"
                  />
                  <button
                    type="button"
                    onClick={handleExtractImage}
                    disabled={extracting}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {extracting ? "이미지 공고 추출 중..." : "이미지 공고 텍스트 추출"}
                  </button>
                </div>

                <textarea
                  value={jobPosting}
                  onChange={(e) => setJobPosting(e.target.value)}
                  placeholder="채용 공고 전문을 붙여넣어 주세요."
                  rows={12}
                  className="mt-3 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                />
              </section>

              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4">
              <button
                type="button"
                onClick={() => setShowInputModal(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={loadingAnalyze || !jobPosting.trim()}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loadingAnalyze ? "분석 중..." : "합격률 분석하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetailModal && selectedAnalysis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selectedAnalysis.job_title}</h3>
                <p className="mt-1 text-xs text-gray-500">{formatDateTime(selectedAnalysis.created_at)}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="rounded-md px-2 py-1 text-2xl text-gray-500 hover:bg-gray-100"
                aria-label="닫기"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-5">
              {selectedAnalysis.result ? (
                <ResultDetail
                  result={selectedAnalysis.result}
                  jobTitle={selectedAnalysis.job_title}
                  jobPosting={selectedAnalysis.job_posting}
                />
              ) : (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                  <p className="text-sm font-semibold text-gray-800">저장된 분석 요약</p>
                  <p className="mt-2 text-sm text-gray-700">{selectedAnalysis.summary}</p>
                  <p className="mt-3 text-sm text-gray-500">총점 {selectedAnalysis.total_score}점 · 등급 {selectedAnalysis.grade}</p>
                  <p className="mt-3 text-xs text-gray-400">
                    상세 데이터가 없는 과거 분석입니다. 새로 분석하면 상세 결과까지 카드에 저장됩니다.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
