"use client";

import { useMemo, useState } from "react";
import { analyzeMatch, extractJobImage } from "@/lib/api/backend";
import { getGuestActivities, isGuestMode } from "@/lib/guest";
import { getProfileExtra } from "@/lib/profile_extra";
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

export default function MatchPage() {
  const supabase = useMemo(() => createBrowserClient(), []);

  const [jobPosting, setJobPosting] = useState("");
  const [result, setResult] = useState<MatchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const handleExtractImage = async () => {
    console.log("🔥 이미지 추출 버튼 클릭됨");

    if (!imageFile) {
      console.log("❌ 파일 없음");
      setError("먼저 이미지 파일을 선택해 주세요.");
      return;
    }

    console.log("📁 파일 있음:", imageFile);

    setExtracting(true);
    setError(null);

    try {
      console.log("🚀 이미지 추출 API 요청 시작");

      const extracted = await extractJobImage(imageFile);

      console.log("✅ 이미지 추출 응답:", extracted);

      const extractedText = extracted?.job_posting_text || "";

      if (!extractedText.trim()) {
        throw new Error("이미지에서 추출된 공고 텍스트가 비어 있습니다.");
      }

      setJobPosting(extractedText);
    } catch (err) {
      console.log("❌ 이미지 추출 에러:", err);
      setError(
        err instanceof Error
          ? err.message
          : "이미지 공고 추출 중 오류가 발생했습니다."
      );
    } finally {
      console.log("🛑 이미지 추출 로딩 종료");
      setExtracting(false);
    }
  };

  const handleAnalyze = async () => {
    if (!jobPosting.trim()) {
      setError("채용 공고 내용을 입력하거나 이미지에서 먼저 추출해 주세요.");
      return;
    }

    setLoading(true);
    setError(null);

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
        const extra = getProfileExtra();

        activities = getGuestActivities().map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description,
        }));

        profileContext = {
          name: "게스트 사용자",
          education: "게스트 모드",
          ...extra,
        };
      } else {
        const [
          { data: activityData, error: activityError },
          { data: profileData, error: profileError },
        ] = await Promise.all([
          supabase
            .from("activities")
            .select("id, title, description")
            .eq("is_visible", true),
          supabase.from("profiles").select("name, education").limit(1).maybeSingle(),
        ]);

        if (activityError) {
          throw new Error(activityError.message);
        }

        if (profileError) {
          throw new Error(profileError.message);
        }

        const extra = getProfileExtra();

        activities = activityData || [];
        profileContext = {
          name: profileData?.name ?? undefined,
          education: profileData?.education ?? undefined,
          ...extra,
        };
      }

      console.log("🚀 공고 분석 요청 시작", {
        job_posting: jobPosting,
        activities,
        profile_context: profileContext,
      });

      const matchResult = await analyzeMatch({
        job_posting: jobPosting,
        activities,
        profile_context: profileContext,
      });

      console.log("✅ 공고 분석 응답:", matchResult);

      setResult(matchResult);
    } catch (err) {
      console.log("❌ 공고 분석 에러:", err);
      setError(
        err instanceof Error ? err.message : "분석 중 오류가 발생했습니다."
      );
    } finally {
      console.log("🛑 공고 분석 로딩 종료");
      setLoading(false);
    }
  };

  const detailedScores = (result?.detailed_scores ?? []) as DetailedScore[];

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">공고 매칭 분석</h1>
        <p className="text-sm text-gray-500 mb-6">
          채용 공고를 붙여넣거나 이미지로 업로드하면 내 경험과의 적합도를 분석해 드립니다.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="bg-white border border-gray-200 rounded-2xl p-4 space-y-3">
              <div>
                <p className="text-sm font-semibold text-gray-900">이미지 공고 업로드</p>
                <p className="text-xs text-gray-500 mt-1">
                  캡처 이미지나 카드형 채용 공고를 올리면 텍스트를 추출해 아래 입력창에 채워줍니다.
                </p>
              </div>

              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={(e) => {
                  const file = e.target.files?.[0] ?? null;
                  console.log("📁 파일 선택됨:", file);
                  setImageFile(file);
                }}
                className="block w-full text-sm text-gray-700"
              />

              <button
                type="button"
                onClick={handleExtractImage}
                disabled={extracting}
                className="w-full px-4 py-3 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                {extracting ? "이미지에서 공고 추출 중..." : "이미지 공고 텍스트 추출"}
              </button>
            </div>

            <textarea
              value={jobPosting}
              onChange={(e) => setJobPosting(e.target.value)}
              placeholder="채용 공고 내용을 붙여넣거나, 위에서 이미지 공고를 업로드하세요..."
              rows={18}
              className="w-full border border-gray-200 rounded-2xl px-4 py-3 text-sm outline-none focus:border-gray-400 resize-none bg-white"
            />

            <button
              onClick={handleAnalyze}
              disabled={loading || !jobPosting.trim()}
              className="w-full px-4 py-3 bg-black text-white rounded-xl font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {loading ? "분석 중..." : "매칭 분석 시작"}
            </button>

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <div>
            {result ? (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 space-y-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-sm text-gray-500">공고 적합도</p>
                    <div className="flex items-end gap-3 mt-1">
                      <p className="text-5xl font-bold text-gray-900">
                        {result.total_score}
                      </p>
                      <p className="text-lg text-gray-400 pb-1">/ 100</p>
                    </div>

                    <div className="flex items-center gap-2 mt-3 flex-wrap">
                      <span className="inline-flex px-3 py-1 rounded-full bg-gray-900 text-white text-xs font-semibold">
                        등급 {result.grade}
                      </span>
                      <span className="inline-flex px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-semibold">
                        {result.support_recommendation}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="rounded-xl bg-gray-50 border border-gray-100 p-4">
                  <p className="text-sm font-semibold text-gray-800 mb-1">한 줄 총평</p>
                  <p className="text-sm text-gray-700 leading-6">{result.summary}</p>
                </div>

                {detailedScores.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-semibold text-gray-800">매칭 점수 상세</p>
                    <div className="grid grid-cols-1 gap-3">
                      {detailedScores.map((item) => (
                        <div
                          key={item.key}
                          className="rounded-xl border border-gray-200 p-4 bg-white"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-gray-900">
                                {item.label}
                              </p>
                              <p className="text-xs text-gray-500 mt-1 leading-5">
                                {item.reason}
                              </p>
                            </div>

                            <div className="text-right shrink-0">
                              <p className="text-sm font-bold text-gray-900">
                                {item.score} / {item.max_score}
                              </p>
                              <span className="inline-flex mt-1 px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">
                                {item.grade}
                              </span>
                            </div>
                          </div>

                          <div className="mt-3 h-2 w-full rounded-full bg-gray-100 overflow-hidden">
                            <div
                              className="h-full rounded-full bg-black"
                              style={{
                                width: `${(item.score / item.max_score) * 100}%`,
                              }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {result.highlight_keywords?.length > 0 && (
                  <div>
                    <p className="text-sm font-semibold text-gray-800 mb-2">
                      핵심 연결 키워드
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {result.highlight_keywords.map((kw: string) => (
                        <span
                          key={kw}
                          className="px-3 py-1 rounded-full bg-blue-50 text-blue-700 text-xs font-medium"
                        >
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="rounded-xl border border-green-100 bg-green-50 p-4">
                    <p className="text-sm font-semibold text-green-800 mb-2">강점</p>
                    <ul className="space-y-2">
                      {(result.strengths ?? []).map((item: string, idx: number) => (
                        <li key={idx} className="text-sm text-green-900 leading-5">
                          • {item}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="rounded-xl border border-red-100 bg-red-50 p-4">
                    <p className="text-sm font-semibold text-red-800 mb-2">보완 포인트</p>
                    <ul className="space-y-2">
                      {(result.gaps ?? []).map((item: string, idx: number) => (
                        <li key={idx} className="text-sm text-red-900 leading-5">
                          • {item}
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>

                {result.resume_tips?.length > 0 && (
                  <div className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-sm font-semibold text-gray-800 mb-2">
                      이력서 반영 팁
                    </p>
                    <ul className="space-y-2">
                      {result.resume_tips.map((tip: string, idx: number) => (
                        <li key={idx} className="text-sm text-gray-700 leading-5">
                          • {tip}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {(result.matched_keywords?.length > 0 ||
                  result.missing_keywords?.length > 0) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {result.matched_keywords?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-2">
                          보유 키워드
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {result.matched_keywords.map((kw: string) => (
                            <span
                              key={kw}
                              className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}

                    {result.missing_keywords?.length > 0 && (
                      <div>
                        <p className="text-xs font-medium text-gray-500 mb-2">
                          보완 키워드
                        </p>
                        <div className="flex flex-wrap gap-1">
                          {result.missing_keywords.map((kw: string) => (
                            <span
                              key={kw}
                              className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs"
                            >
                              {kw}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-200 p-6 h-full flex items-center justify-center">
                <p className="text-gray-400 text-sm">분석 결과가 여기에 표시됩니다.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}