// 공고 매칭 분석 페이지 - 채용 공고와 내 경험 비교
"use client";

import { useMemo, useState } from "react";
import { analyzeMatch } from "@/lib/api/backend";
import { getGuestActivities, isGuestMode } from "@/lib/guest";
import { createBrowserClient } from "@/lib/supabase/client";
import type { MatchResult } from "@/lib/types";

export default function MatchPage() {
  const supabase = useMemo(() => createBrowserClient(), []);
  const [jobPosting, setJobPosting] = useState("");
  const [result, setResult] = useState<MatchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAnalyze = async () => {
    if (!jobPosting.trim()) return;
    setLoading(true);
    setError(null);

    try {
      let activities: { id: string; title: string; description: string | null }[] = [];
      if (isGuestMode()) {
        activities = getGuestActivities().map((item) => ({
          id: item.id,
          title: item.title,
          description: item.description,
        }));
      } else {
        const { data, error: activityError } = await supabase
          .from("activities")
          .select("id, title, description")
          .eq("is_visible", true);
        if (activityError) {
          throw new Error(activityError.message);
        }
        activities = data || [];
      }

      const matchResult = await analyzeMatch({
        job_posting: jobPosting,
        activities,
      });
      setResult(matchResult);
    } catch (err) {
      setError(err instanceof Error ? err.message : "분석 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-2">공고 매칭 분석</h1>
        <p className="text-sm text-gray-500 mb-6">
          채용 공고를 붙여넣으면 내 경험과의 매칭률을 분석해 드립니다.
        </p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="space-y-3">
            <textarea
              value={jobPosting}
              onChange={(e) => setJobPosting(e.target.value)}
              placeholder="채용 공고 내용을 붙여넣으세요..."
              rows={15}
              className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm outline-none focus:border-gray-400 resize-none bg-white"
            />
            <button
              onClick={handleAnalyze}
              disabled={loading || !jobPosting.trim()}
              className="w-full px-4 py-3 bg-black text-white rounded-lg font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
            >
              {loading ? "분석 중..." : "매칭 분석 시작"}
            </button>
            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <div>
            {result ? (
              <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-5">
                {/* 매칭 점수 */}
                <div className="text-center">
                  <p className="text-sm text-gray-500">매칭률</p>
                  <p className="text-5xl font-bold text-gray-900 mt-1">
                    {result.match_score}%
                  </p>
                </div>

                {/* 요약 */}
                <p className="text-sm text-gray-700">{result.summary}</p>

                {/* 매칭 키워드 */}
                {result.matched_keywords.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">보유 키워드</p>
                    <div className="flex flex-wrap gap-1">
                      {result.matched_keywords.map((kw) => (
                        <span key={kw} className="px-2 py-0.5 bg-green-100 text-green-700 rounded text-xs">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {/* 부족 키워드 */}
                {result.missing_keywords.length > 0 && (
                  <div>
                    <p className="text-xs font-medium text-gray-500 mb-2">부족한 키워드</p>
                    <div className="flex flex-wrap gap-1">
                      {result.missing_keywords.map((kw) => (
                        <span key={kw} className="px-2 py-0.5 bg-red-100 text-red-700 rounded text-xs">
                          {kw}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-gray-200 p-6 h-full flex items-center justify-center">
                <p className="text-gray-400 text-sm">분석 결과가 여기에 표시됩니다.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
}
