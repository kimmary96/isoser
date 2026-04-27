// 활동 목록 페이지 - 모든 활동을 카드로 표시
"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { listActivities } from "@/lib/api/app";
import { getActivityImageUrls, getActivityIntroLines } from "@/lib/activity-display";
import type { Activity } from "@/lib/types";
import { cx, iso } from "@/components/ui/isoser-ui";

export default function ActivitiesPage() {
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
      try {
        const data = await listActivities();
        setActivities(data.activities || []);
      } catch (e) {
        setError(e instanceof Error ? e.message : "활동을 불러오지 못했습니다.");
      } finally {
        setLoading(false);
      }
    };
    fetchActivities();
  }, []);

  if (loading) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#f3f6fb]">
        <p className="text-slate-500">불러오는 중...</p>
      </main>
    );
  }

  return (
    <main className={iso.page}>
      <div className="mx-auto max-w-7xl px-8 py-8">
        <div className="mb-6 flex items-start justify-between">
          <div>
            <h1
              className="mb-1 text-2xl font-bold tracking-tight text-slate-950"
              style={{ fontFamily: "Pretendard, sans-serif" }}
            >
              성과 저장소
            </h1>
            <p className="text-sm text-slate-500">
              당신의 성장을 증명하는 모든 순간의 기록입니다.
            </p>
          </div>
          <Link
            href="/dashboard/activities/new"
            className={cx("flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold", iso.primaryButton)}
          >
            + 새 성과 기록하기
          </Link>
        </div>

        <div className="mb-6 flex items-center gap-3 rounded-2xl border border-blue-100 bg-[#eef6ff] px-4 py-3">
          <svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" className="text-slate-400">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <span className="text-sm text-slate-400">성과 기록 검색...</span>
        </div>

        <div className="mb-8 flex flex-wrap gap-2">
          {FILTERS.map((filter) => (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={`rounded-full px-4 py-2 text-sm font-medium transition-all ${
                activeFilter === filter
                  ? "bg-[#071a36] text-white"
                  : "border border-slate-200 bg-white text-slate-600 hover:border-orange-200 hover:text-orange-700"
              }`}
            >
              {filter}
              {filterCounts[filter] > 0 && (
                <span className={`ml-1.5 text-xs ${
                  activeFilter === filter ? "text-blue-100" : "text-slate-400"
                }`}>
                  {filterCounts[filter]}
                </span>
              )}
            </button>
          ))}
        </div>

        {error && (
          <p className="mb-4 text-sm text-red-600">{error}</p>
        )}

        {filteredActivities.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white py-20 text-center text-slate-400 shadow-[0_12px_32px_rgba(15,23,42,0.05)]">
            <p className="mb-2 text-lg">아직 기록된 성과가 없습니다.</p>
            <p className="text-sm">PDF를 업로드하거나 직접 활동을 추가해보세요.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
            {filteredActivities.map((activity) => {
              const previewLines = getActivityIntroLines(activity);
              const coverImage = getActivityImageUrls(activity)[0];

              return (
                <Link
                  key={activity.id}
                  href={`/dashboard/activities/${activity.id}`}
                  className="group block overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.05)] transition-all hover:-translate-y-0.5 hover:border-orange-200 hover:shadow-[0_18px_40px_rgba(15,23,42,0.08)]"
                >
                  <div
                    className="h-40 flex items-center justify-center relative"
                    style={
                      coverImage
                        ? undefined
                        : { background: "linear-gradient(135deg, #f4f9ff 0%, #dbeafe 52%, #eef6ff 100%)" }
                    }
                  >
                    {coverImage ? (
                      <>
                        <Image
                          src={coverImage}
                          alt={`${activity.title} 대표 이미지`}
                          fill
                          sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                          className="object-cover"
                        />
                        <div className="absolute inset-0 bg-slate-950/10" />
                      </>
                    ) : (
                      <svg width="40" height="40" fill="none" viewBox="0 0 24 24" stroke="rgba(9,76,178,0.18)" strokeWidth={1}>
                        <rect x="3" y="3" width="18" height="18" rx="2" />
                        <circle cx="8.5" cy="8.5" r="1.5" />
                        <path d="M21 15l-5-5L5 21" />
                      </svg>
                    )}
                    <div className="absolute top-3 left-3">
                      <span className="rounded-full px-2.5 py-1 text-xs font-semibold" style={{ background: "rgba(255,241,230,0.94)", color: "#c94f12" }}>
                        {activity.type}
                      </span>
                    </div>
                  </div>

                  <div className="p-4">
                    <p className="mb-1 text-xs text-slate-400">{activity.period || ""}</p>
                    <h3
                      className="mb-2 line-clamp-2 text-sm font-bold leading-snug text-slate-950"
                      style={{ fontFamily: "Pretendard, sans-serif" }}
                    >
                      {activity.title}
                    </h3>
                    {previewLines.length > 0 && (
                      <div className="mb-3 space-y-1">
                        {previewLines.map((line, index) => (
                          <p key={`${activity.id}-preview-${index}`} className="line-clamp-1 text-xs text-slate-500">
                            {index === 0 && activity.description ? line : `- ${line}`}
                          </p>
                        ))}
                      </div>
                    )}
                    {Array.isArray(activity.skills) && activity.skills.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {activity.skills.slice(0, 3).map((skill, i) => (
                          <span
                            key={i}
                            className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600"
                          >
                            #{skill}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-3 flex justify-end">
                      <span className="text-xs font-semibold text-[#e0621a] group-hover:underline">
                        상세보기 →
                      </span>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
