// 활동 목록 페이지 - 모든 활동을 카드로 표시
"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase/client";
import type { Activity } from "@/lib/types";

const TYPE_LABELS: Record<string, string> = {
  회사경력: "💼 회사경력",
  프로젝트: "🛠 프로젝트",
  대외활동: "🌐 대외활동",
  학생활동: "🎓 학생활동",
};

export default function ActivitiesPage() {
  const supabase = useMemo(() => createBrowserClient(), []);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const { data, error: queryError } = await supabase
          .from("activities")
          .select("*")
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
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">내 활동</h1>
          <Link
            href="/dashboard/onboarding"
            className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            + 활동 추가
          </Link>
        </div>
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        {activities.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <p className="text-lg">아직 활동이 없습니다.</p>
            <p className="text-sm mt-2">기존 이력서 PDF를 업로드하거나 직접 추가해보세요.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {activities.map((activity) => (
              <Link
                key={activity.id}
                href={`/dashboard/activities/${activity.id}`}
                className="block bg-white rounded-xl border border-gray-200 p-5 hover:border-gray-400 transition-colors"
              >
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-xs text-gray-400 mb-1">
                      {TYPE_LABELS[activity.type] || activity.type}
                    </p>
                    <h2 className="font-semibold text-gray-900">{activity.title}</h2>
                    {activity.period && (
                      <p className="text-sm text-gray-500 mt-0.5">{activity.period}</p>
                    )}
                  </div>
                  <svg className="w-4 h-4 text-gray-400 mt-1 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
                {activity.skills && activity.skills.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-3">
                    {activity.skills.slice(0, 5).map((skill) => (
                      <span key={skill} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </Link>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
