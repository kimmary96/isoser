"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

import { PortfolioExportPreview } from "@/app/dashboard/portfolio/export/_components/portfolio-export-preview";
import { usePortfolioExport } from "@/app/dashboard/portfolio/export/_hooks/use-portfolio-export";

function PortfolioDocumentPreviewContent() {
  const searchParams = useSearchParams();
  const portfolioId = searchParams.get("portfolioId");
  const { document, profile, loading, error } = usePortfolioExport(portfolioId);

  return (
    <main className="min-h-screen bg-[#e8edf5] px-4 py-6">
      <div className="mx-auto max-w-[210mm]">
        {error && (
          <p className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        )}
        <PortfolioExportPreview
          document={document}
          profile={profile}
          loading={loading}
          embedded
        />
      </div>
    </main>
  );
}

export default function PortfolioDocumentPreviewPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-screen items-center justify-center bg-[#e8edf5]">
          <p className="text-sm text-slate-500">불러오는 중...</p>
        </main>
      }
    >
      <PortfolioDocumentPreviewContent />
    </Suspense>
  );
}
