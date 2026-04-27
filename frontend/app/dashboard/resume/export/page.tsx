// PDF 출력 페이지 - react-pdf로 이력서 PDF 미리보기용 문서 생성
"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import Image from "next/image";
import { useSearchParams } from "next/navigation";
import { useResumeExport } from "./_hooks/use-resume-export";
import { getActivityMetaItems } from "@/lib/activity-display";
import { normalizeResumeActivityLineOverrides } from "@/lib/resume-line-overrides";
import { getResumeActivityBodyLines } from "@/lib/resume-display";
import { getResumeProfileHighlightSections } from "@/lib/resume-profile";
import type { Activity, ResumeBuilderProfile } from "@/lib/types";

const ResumePdfDownload = dynamic(
  () => import("./_components/resume-pdf-download").then((mod) => mod.ResumePdfDownload),
  {
    ssr: false,
    loading: () => (
      <div className="block w-full rounded-lg bg-gray-100 px-4 py-3 text-center font-medium text-gray-500">
        PDF 모듈 로딩 중...
      </div>
    ),
  }
);

function isCareerActivity(activity: Activity): boolean {
  return activity.type === "회사경력";
}

function ExportProfileIntro({ profile }: { profile: ResumeBuilderProfile | null }) {
  if (!profile?.self_intro) return null;
  return (
    <section className="rounded-lg bg-gray-50 p-3">
      <p className="text-[11px] font-semibold tracking-widest text-gray-400">
        PROFESSIONAL PROFILE
      </p>
      <p className="mt-2 text-sm leading-6 text-gray-700">{profile.self_intro}</p>
    </section>
  );
}

function ExportProfileHighlights({ profile }: { profile: ResumeBuilderProfile | null }) {
  const sections = getResumeProfileHighlightSections(profile);
  if (sections.length === 0) return null;

  return (
    <section className="rounded-lg border border-gray-100 bg-gray-50 p-3">
      <p className="text-[11px] font-semibold tracking-widest text-gray-400">
        AWARDS · CERTIFICATIONS · LANGUAGE
      </p>
      <div className="mt-2 grid gap-2 sm:grid-cols-3">
        {sections.map((section) => (
          <div key={section.key}>
            <p className="text-xs font-bold text-gray-800">{section.title}</p>
            <div className="mt-1 space-y-1">
              {section.items.map((item, index) => (
                <p key={`${section.key}-${item}-${index}`} className="text-xs text-gray-600">
                  {item}
                </p>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}

function ExportActivityList({
  title,
  activities,
  activityLineOverrides,
}: {
  title: string;
  activities: Activity[];
  activityLineOverrides: ReturnType<typeof normalizeResumeActivityLineOverrides>;
}) {
  if (activities.length === 0) return null;

  return (
    <section className="space-y-3">
      <p className="text-[11px] font-semibold tracking-widest text-gray-400">{title}</p>
      {activities.map((activity) => {
        const metaItems = getActivityMetaItems(activity);
        const bodyLines = getResumeActivityBodyLines(activity, activityLineOverrides);

        return (
          <div key={activity.id} className="rounded-lg border border-gray-200 p-3">
            <p className="text-sm font-medium text-gray-900">{activity.title}</p>
            <p className="mt-1 text-xs text-gray-500">
              {activity.type} | {activity.period ?? "기간 미입력"}
            </p>
            {metaItems.length > 0 && (
              <p className="mt-2 text-xs text-gray-500">{metaItems.join(" · ")}</p>
            )}
            <div className="mt-2 space-y-1">
              {bodyLines.map((line, index) => (
                <p key={`${activity.id}-export-preview-${index}`} className="text-sm text-gray-700">
                  - {line}
                </p>
              ))}
            </div>
          </div>
        );
      })}
    </section>
  );
}

function ResumeExportContent() {
  const searchParams = useSearchParams();
  const resumeId = searchParams.get("resumeId");
  const embedded = searchParams.get("embedded") === "true";
  const templateName = "기본형";
  const { resume, activities, profile, loading, error } = useResumeExport(resumeId);
  const activityLineOverrides = normalizeResumeActivityLineOverrides(
    resume?.activity_line_overrides
  );
  const careerActivities = activities.filter(isCareerActivity);
  const projectActivities = activities.filter((activity) => !isCareerActivity(activity));

  const preview = (
    <div
      className={`rounded-xl border border-gray-200 bg-white p-6 ${
        embedded ? "min-h-[720px]" : "min-h-[600px]"
      }`}
    >
      {loading ? (
        <p className="text-sm text-gray-400">불러오는 중...</p>
      ) : !resume ? (
        <p className="text-sm text-gray-400">저장된 이력서가 없습니다.</p>
      ) : (
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className="flex h-20 w-20 flex-shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gray-100">
                {profile?.avatar_url ? (
                  <Image
                    src={profile.avatar_url}
                    alt={`${profile.name || "프로필"} 아바타`}
                    width={80}
                    height={80}
                    sizes="80px"
                    unoptimized
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="text-2xl text-gray-300">👤</span>
                )}
              </div>
              <div>
                <p className="text-lg font-semibold text-gray-900">
                  {profile?.name || resume.title}
                </p>
                <p className="text-sm text-gray-500">
                  지원 직무: {resume.target_job ?? "미입력"}
                </p>
                {profile?.bio && <p className="text-sm text-gray-500">{profile.bio}</p>}
                {(profile?.email || profile?.phone) && (
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-gray-400">
                    {profile?.email && <span>✉ {profile.email}</span>}
                    {profile?.phone && <span>☎ {profile.phone}</span>}
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-gray-400">{resume.title}</p>
          </div>
          <div className="space-y-3">
            <ExportProfileIntro profile={profile} />
            <ExportActivityList
              title="WORK EXPERIENCE"
              activities={careerActivities}
              activityLineOverrides={activityLineOverrides}
            />
            <ExportProfileHighlights profile={profile} />
            <ExportActivityList
              title="KEY EXPERIENCE"
              activities={projectActivities}
              activityLineOverrides={activityLineOverrides}
            />
          </div>
        </div>
      )}
    </div>
  );

  return (
    <main className="min-h-screen bg-gray-50">
      <div className={embedded ? "mx-auto max-w-3xl px-3 py-3" : "mx-auto max-w-4xl px-4 py-8"}>
        {!embedded && <h1 className="mb-6 text-2xl font-bold text-gray-900">PDF 출력</h1>}
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        <div className={embedded ? "block" : "grid grid-cols-1 gap-6 lg:grid-cols-2"}>
          {preview}

          {!embedded && (
            <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="mb-4 font-semibold text-gray-900">PDF 출력</h2>
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">
                    디자인
                  </label>
                  <p className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700">
                    {templateName}
                  </p>
                </div>
              </div>
            </div>

            {!loading && resume && (
              <ResumePdfDownload resume={resume} activities={activities} profile={profile} />
            )}
            </div>
          )}
        </div>
      </div>
    </main>
  );
}

export default function ResumeExportPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-gray-50 flex items-center justify-center">
          <p className="text-gray-500">불러오는 중...</p>
        </main>
      }
    >
      <ResumeExportContent />
    </Suspense>
  );
}
