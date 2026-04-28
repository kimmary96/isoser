// PDF 출력 페이지 - react-pdf로 이력서 PDF 미리보기용 문서 생성
"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useResumeExport } from "./_hooks/use-resume-export";
import { ResumeExportPreview } from "./_components/resume-export-preview";

const ResumePdfDownload = dynamic(
  () => import("./_components/resume-pdf-download").then((mod) => mod.ResumePdfDownload),
  {
    ssr: false,
    loading: () => (
      <div className="block w-full rounded-xl bg-slate-100 px-4 py-3 text-center text-sm font-semibold text-slate-500">
        PDF 모듈 로딩 중...
      </div>
    ),
  }
);

function ResumeExportContent() {
  const searchParams = useSearchParams();
  const resumeId = searchParams.get("resumeId");
  const embedded = searchParams.get("embedded") === "true";
  const templateName = "기본형";
  const { resume, activities, profile, loading, error } = useResumeExport(resumeId);

  return (
    <main className={`min-h-screen bg-[#f3f6fb] text-slate-950 ${embedded ? "px-3 py-3" : "px-4 py-8"}`}>
      <div className={embedded ? "mx-auto max-w-3xl" : "mx-auto max-w-6xl"}>
        {!embedded && (
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold text-[#094cb2]">이력서 PDF 출력</p>
              <h1 className="mt-1 text-2xl font-bold text-slate-950">
                {resume?.title || "이력서"}
              </h1>
            </div>
            <Link
              href="/dashboard/resume"
              className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-50"
            >
              빌더로 돌아가기
            </Link>
          </div>
        )}
        {error && (
          <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        )}

        <div className={embedded ? "block" : "grid gap-5 lg:grid-cols-[minmax(0,1fr)_320px]"}>
          <ResumeExportPreview
            resume={resume}
            activities={activities}
            profile={profile}
            loading={loading}
            embedded={embedded}
          />

          {!embedded && (
            <div className="space-y-4">
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
                <h2 className="text-sm font-bold text-slate-950">출력 설정</h2>
                <p className="mt-2 text-sm leading-6 text-slate-500">
                  저장된 이력서 문서를 기준으로 PDF를 생성합니다.
                </p>
                <div className="mt-4 space-y-2 text-sm text-slate-600">
                  <p>활동 {activities.length}개</p>
                  <p>디자인 {templateName}</p>
                </div>
              </section>

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
        <main className="flex min-h-screen items-center justify-center bg-[#f3f6fb]">
          <p className="text-sm text-slate-500">불러오는 중...</p>
        </main>
      }
    >
      <ResumeExportContent />
    </Suspense>
  );
}
