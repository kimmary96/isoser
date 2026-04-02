// 메인 대시보드 페이지 - 활동/이력서/코치 세션 통계 요약
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

import { getGuestActivities, isGuestMode } from "@/lib/guest";
import { createBrowserClient } from "@/lib/supabase/client";

interface DashboardStats {
  activities: number;
  resumes: number;
  sessions: number;
}

export default function DashboardPage() {
  const supabase = useMemo(() => createBrowserClient(), []);
  const [stats, setStats] = useState<DashboardStats>({
    activities: 0,
    resumes: 0,
    sessions: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      if (isGuestMode()) {
        setStats({
          activities: getGuestActivities().length,
          resumes: 1,
          sessions: 0,
        });
        setLoading(false);
        return;
      }

      try {
        const [{ count: activityCount }, { count: resumeCount }, { count: sessionCount }] =
          await Promise.all([
            supabase.from("activities").select("*", { count: "exact", head: true }),
            supabase.from("resumes").select("*", { count: "exact", head: true }),
            supabase.from("coach_sessions").select("*", { count: "exact", head: true }),
          ]);

        setStats({
          activities: activityCount ?? 0,
          resumes: resumeCount ?? 0,
          sessions: sessionCount ?? 0,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchStats();
  }, [supabase]);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-gray-900">대시보드</h1>
          <Link
            href="/dashboard/onboarding"
            className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            + 경험 추가
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <p className="text-sm text-gray-500">총 활동</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{loading ? "-" : stats.activities}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <p className="text-sm text-gray-500">이력서</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{loading ? "-" : stats.resumes}</p>
          </div>
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <p className="text-sm text-gray-500">AI 코치 세션</p>
            <p className="text-3xl font-bold text-gray-900 mt-1">{loading ? "-" : stats.sessions}</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Link
            href="/dashboard/activities"
            className="bg-white rounded-xl border border-gray-200 p-6 hover:border-gray-400 transition-colors"
          >
            <h2 className="font-semibold text-gray-900 mb-1">내 활동 관리</h2>
            <p className="text-sm text-gray-500">프로젝트, 경력, 대외활동을 관리하고 AI 코치의 피드백을 받으세요</p>
          </Link>
          <Link
            href="/dashboard/resume"
            className="bg-white rounded-xl border border-gray-200 p-6 hover:border-gray-400 transition-colors"
          >
            <h2 className="font-semibold text-gray-900 mb-1">이력서 편집</h2>
            <p className="text-sm text-gray-500">활동을 선택해 이력서를 구성하고 PDF로 출력하세요</p>
          </Link>
          <Link
            href="/dashboard/match"
            className="bg-white rounded-xl border border-gray-200 p-6 hover:border-gray-400 transition-colors"
          >
            <h2 className="font-semibold text-gray-900 mb-1">공고 매칭 분석</h2>
            <p className="text-sm text-gray-500">채용 공고를 붙여넣으면 내 경험과의 매칭률을 분석해 드립니다</p>
          </Link>
        </div>
      </div>
    </main>
  );
}
