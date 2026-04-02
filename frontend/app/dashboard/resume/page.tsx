// 이력서 편집 페이지 - 활동 선택 및 이력서 구성
"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase/client";
import type { Activity } from "@/lib/types";

export default function ResumePage() {
  const supabase = createBrowserClient();
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetJob, setTargetJob] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActivities = async () => {
      const { data } = await supabase
        .from("activities")
        .select("*")
        .eq("is_visible", true)
        .order("created_at", { ascending: false });
      setActivities(data || []);
      setLoading(false);
    };
    fetchActivities();
  }, [supabase]);

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

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
          <h1 className="text-2xl font-bold text-gray-900">이력서 편집</h1>
          <Link
            href="/dashboard/resume/export"
            className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            PDF 출력 →
          </Link>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            지원 직무
          </label>
          <input
            type="text"
            placeholder="예: 프로덕트 매니저, 백엔드 개발자"
            value={targetJob}
            onChange={(e) => setTargetJob(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm outline-none focus:border-gray-400"
          />
        </div>

        <div className="space-y-3">
          <p className="text-sm text-gray-500">
            이력서에 포함할 활동을 선택하세요 ({selected.size}개 선택됨)
          </p>
          {activities.map((activity) => (
            <label
              key={activity.id}
              className={`flex items-start gap-3 bg-white rounded-xl border p-4 cursor-pointer transition-colors ${
                selected.has(activity.id)
                  ? "border-black"
                  : "border-gray-200 hover:border-gray-400"
              }`}
            >
              <input
                type="checkbox"
                checked={selected.has(activity.id)}
                onChange={() => toggleSelect(activity.id)}
                className="mt-0.5"
              />
              <div>
                <p className="text-xs text-gray-400">{activity.type}</p>
                <p className="font-medium text-gray-900">{activity.title}</p>
                {activity.period && (
                  <p className="text-sm text-gray-500">{activity.period}</p>
                )}
              </div>
            </label>
          ))}
        </div>
      </div>
    </main>
  );
}
