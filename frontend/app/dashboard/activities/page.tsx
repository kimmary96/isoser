// 활동 목록 페이지 - 모든 활동을 카드로 표시
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { getGuestActivities, isGuestMode } from "@/lib/guest";
import { createBrowserClient } from "@/lib/supabase/client";
import type { Activity } from "@/lib/types";

export default function ActivitiesPage() {
  const supabase = useMemo(() => createBrowserClient(), []);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeFilter, setActiveFilter] = useState<string>("전체");

  const FILTERS = ["전체", "회사경력", "프로젝트", "대외활동", "학생활동"];

  const filteredActivities = activeFilter === "전체"
    ? activities
    : activities.filter((a) => a.type === activeFilter);

  const filterCounts = FILTERS.reduce((acc, f) => {
    acc[f] = f === "전체"
      ? activities.length
      : activities.filter((a) => a.type === f).length;
    return acc;
  }, {} as Record<string, number>);

  useEffect(() => {
    const fetchActivities = async () => {
      if (isGuestMode()) {
        setActivities(getGuestActivities());
        setLoading(false);
        return;
      }

      try {
        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser();
        if (authError || !user) {
          throw new Error("로그인이 필요합니다.");
        }

        const { data, error: queryError } = await supabase
          .from("activities")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false });
        if (queryError) {
          throw new Error(queryError.message);
        }
        setActivities(data || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "활동을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };
    fetchActivities();
  }, [supabase]);

  if (loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-gray-500">불러오는 중...</p>
      </main>
    );
  }

  return (
    <main className="bg-white min-h-screen">
      <div className="max-w-6xl mx-auto px-8 py-8">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h1
              className="text-2xl font-bold text-gray-900 mb-1"
              style={{ fontFamily: "Pretendard, sans-serif" }}
            >
              성과 저장소
            </h1>
            <p className="text-sm text-gray-400">
              당신의 성장을 증명하는 모든 순간의 기록입니다.
            </p>
          </div>
          <Link
            href="/dashboard/activities/new"
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white"
            style={{ background: "linear-gradient(135deg, #094cb2, #3b82f6)" }}
          >
            + 새 성과 기록하기
          </Link>
        </div>

        <div className="flex items-center gap-3 bg-gray-50 rounded-xl px-4 py-3 mb-6">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-gray-400">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <span className="text-sm text-gray-400">성과 기록 검색...</span>
        </div>

        <div className="flex gap-2 mb-8 flex-wrap">
          {FILTERS.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition-all ${
                activeFilter === filter
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {filter}
              {filterCounts[filter] > 0 && (
                <span className={`ml-1.5 text-xs ${
                  activeFilter === filter ? "text-blue-200" : "text-gray-400"
                }`}>
                  {filterCounts[filter]}
                </span>
              )}
            </button>
          ))}
        </div>

        {error && (
          <p className="text-red-500 text-sm mb-4">{error}</p>
        )}

        {filteredActivities.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg mb-2">아직 기록된 성과가 없습니다.</p>
            <p className="text-sm">PDF를 업로드하거나 직접 활동을 추가해보세요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredActivities.map((activity) => (
              <Link
                key={activity.id}
                href={`/dashboard/activities/${activity.id}`}
                className="group block bg-white rounded-2xl overflow-hidden border border-gray-100 hover:border-blue-200 hover:shadow-md transition-all"
              >
                <div
                  className="h-40 flex items-center justify-center relative"
                  style={{ background: "linear-gradient(135deg, #1e3a5f, #2d5a8e)" }}
                >
                  <div className="absolute top-3 left-3">
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full" style={{ background: "rgba(109,94,0,0.85)", color: "#fef3c7" }}>
                      {activity.type}
                    </span>
                  </div>
                  <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="rgba(255,255,255,0.3)" strokeWidth={1}>
                    <rect x="3" y="3" width="18" height="18" rx="2" />
                    <circle cx="8.5" cy="8.5" r="1.5" />
                    <path d="M21 15l-5-5L5 21" />
                  </svg>
                </div>

                <div className="p-4">
                  <p className="text-xs text-gray-400 mb-1">{activity.period || ""}</p>
                  <h3
                    className="font-bold text-gray-900 text-sm leading-snug mb-2 line-clamp-2"
                    style={{ fontFamily: "Pretendard, sans-serif" }}
                  >
                    {activity.title}
                  </h3>
                  {activity.description && (
                    <p className="text-xs text-gray-500 line-clamp-2 mb-3">
                      {activity.description}
                    </p>
                  )}
                  {Array.isArray(activity.skills) && activity.skills.length > 0 && (
                    <div className="flex flex-wrap gap-1.5">
                      {activity.skills.slice(0, 3).map((skill, i) => (
                        <span
                          key={i}
                          className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-600"
                        >
                          #{skill}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="flex justify-end mt-3">
                    <span className="text-xs text-blue-500 group-hover:underline">
                      상세보기 →
                    </span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
