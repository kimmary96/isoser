"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { ResumeExportPreview } from "@/app/dashboard/resume/export/_components/resume-export-preview";
import { useResumeExport } from "@/app/dashboard/resume/export/_hooks/use-resume-export";

function ResumeDocumentPreviewContent() {
  const searchParams = useSearchParams();
  const resumeId = searchParams.get("resumeId");
  const { resume, activities, profile, loading, error } = useResumeExport(resumeId);

  return (
    <main className="min-h-screen bg-[#e8edf5] px-4 py-6">
      <div className="mx-auto max-w-[210mm]">
        {error && (
          <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        )}
        <ResumeExportPreview
          resume={resume}
          activities={activities}
          profile={profile}
          loading={loading}
          embedded
        />
      </div>
    </main>
  );
}

export default function ResumeDocumentPreviewPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#e8edf5]">
          <p className="text-sm text-slate-500">불러오는 중...</p>
        </main>
      }
    >
      <ResumeDocumentPreviewContent />
    </Suspense>
  );
}
