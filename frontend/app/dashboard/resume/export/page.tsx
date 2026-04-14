// PDF 출력 페이지 - react-pdf로 이력서 PDF 미리보기용 문서 생성
"use client";

import { Suspense } from "react";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { useResumeExport } from "./_hooks/use-resume-export";

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

function ResumeExportContent() {
  const searchParams = useSearchParams();
  const resumeId = searchParams.get("resumeId");
  const { resume, activities, loading, error } = useResumeExport(resumeId);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">PDF 출력</h1>
        {error && <p className="text-sm text-red-600 mb-4">{error}</p>}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* 미리보기 영역 */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 min-h-[600px]">
            {loading ? (
              <p className="text-gray-400 text-sm">불러오는 중...</p>
            ) : !resume ? (
              <p className="text-gray-400 text-sm">저장된 이력서가 없습니다.</p>
            ) : (
              <div className="space-y-4">
                <div>
                  <p className="text-lg font-semibold text-gray-900">{resume.title}</p>
                  <p className="text-sm text-gray-500">지원 직무: {resume.target_job ?? "미입력"}</p>
                </div>
                <div className="space-y-3">
                  {activities.map((activity) => (
                    <div key={activity.id} className="border border-gray-200 rounded-lg p-3">
                      <p className="text-sm font-medium text-gray-900">{activity.title}</p>
                      <p className="text-xs text-gray-500 mt-1">
                        {activity.type} | {activity.period ?? "기간 미입력"}
                      </p>
                      <p className="text-sm text-gray-700 mt-2 whitespace-pre-wrap">
                        {activity.description || "설명 없음"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* 설정 */}
          <div className="space-y-4">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h2 className="font-semibold text-gray-900 mb-4">출력 설정</h2>
              <div className="space-y-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    템플릿
                  </label>
                  <p className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm text-gray-700">
                    simple
                  </p>
                </div>
              </div>
            </div>

            {!loading && resume && <ResumePdfDownload resume={resume} activities={activities} />}
          </div>
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
