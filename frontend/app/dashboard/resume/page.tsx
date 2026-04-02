// 이력서 편집 페이지 - 활동 선택 및 이력서 구성
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase/client";
import type { Activity } from "@/lib/types";

export default function ResumePage() {
  const router = useRouter();
  const supabase = useMemo(() => createBrowserClient(), []);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [targetJob, setTargetJob] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchActivities = async () => {
      try {
        const { data, error: queryError } = await supabase
          .from("activities")
          .select("*")
          .eq("is_visible", true)
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

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleCreateResume = async () => {
    setSaving(true);
    setError(null);
    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || !authData.user) {
        throw new Error("로그인이 필요합니다.");
      }

      const payload = {
        user_id: authData.user.id,
        title: `이력서 ${new Date().toISOString().slice(0, 10)}`,
        target_job: targetJob || null,
        template_id: "simple",
        selected_activity_ids: Array.from(selected),
      };

      const { data, error: insertError } = await supabase
        .from("resumes")
        .insert(payload)
        .select("id")
        .single();
      if (insertError || !data) {
        throw new Error(insertError?.message ?? "이력서 저장에 실패했습니다.");
      }

      router.push(`/dashboard/resume/export?resumeId=${data.id}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "이력서 저장 중 오류가 발생했습니다.");
    } finally {
      setSaving(false);
    }
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
          <button
            onClick={handleCreateResume}
            disabled={saving || selected.size === 0}
            className="px-4 py-2 bg-black text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors disabled:opacity-50"
          >
            {saving ? "저장 중..." : "저장 후 PDF 출력 →"}
          </button>
        </div>
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

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
