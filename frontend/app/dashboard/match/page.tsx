"use client";

import { MatchAnalysisDetailModal } from "./_components/match-analysis-detail-modal";
import { MatchAnalysisInputModal } from "./_components/match-analysis-input-modal";
import { useMatchPage } from "./_hooks/use-match-page";

function formatDateTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return date.toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getScorePercent(score: number): number {
  return Math.min(100, Math.max(0, score));
}

export default function MatchPage() {
  const {
    savedAnalyses,
    selectedAnalysis,
    setSelectedAnalysis,
    showInputModal,
    setShowInputModal,
    showDetailModal,
    setShowDetailModal,
    analysisMode,
    setAnalysisMode,
    companyName,
    setCompanyName,
    positionName,
    setPositionName,
    jobPosting,
    setJobPosting,
    imageFiles,
    pdfFile,
    setPdfFile,
    resumeOptions,
    selectedResumeId,
    setSelectedResumeId,
    loadingResumes,
    loadingList,
    loadingAnalyze,
    deletingId,
    extracting,
    error,
    saveNotice,
    addImageFiles,
    clearImageFiles,
    removeImageFile,
    loadResumeOptions,
    handleExtractImage,
    handleExtractPdf,
    handleAnalyze,
    handleDeleteSavedAnalysis,
    openInputModal,
  } = useMatchPage();

  return (
    <main className="min-h-screen bg-[#f3f6fb]">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <section className="mb-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#094cb2]">AI COACHING</p>
              <h1 className="mt-2 text-[26px] font-bold tracking-tight text-slate-950">공고 매칭 분석</h1>
              <p className="mt-2 text-sm leading-6 text-slate-500">관심 공고와 내 이력서·활동의 맞는 지점을 분석하고 저장해 비교합니다.</p>
            </div>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <div className="rounded-2xl border border-slate-200 bg-[#f8fbff] px-4 py-3 text-sm">
                <p className="text-xs font-medium text-slate-500">저장된 분석</p>
                <p className="mt-1 font-semibold text-slate-900">{savedAnalyses.length}건</p>
              </div>
              <button
                type="button"
                onClick={openInputModal}
                className="rounded-2xl bg-gradient-to-r from-[#094cb2] to-[#3b82f6] px-5 py-3 text-sm font-semibold text-white shadow-[0_12px_24px_rgba(9,76,178,0.22)] transition hover:brightness-105"
              >
                합격률 분석하기
              </button>
            </div>
          </div>
        </section>

        {saveNotice && (
          <p className="mb-4 rounded-2xl border border-orange-100 bg-[#fff7ed] px-4 py-3 text-sm font-medium text-[#c94f12]">
            {saveNotice}
          </p>
        )}

        {loadingList ? (
          <div className="rounded-3xl border border-slate-200 bg-white p-8 text-sm text-slate-500 shadow-[0_16px_40px_rgba(15,23,42,0.05)]">저장된 분석을 불러오는 중...</div>
        ) : savedAnalyses.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center shadow-[0_16px_40px_rgba(15,23,42,0.04)]">
            <p className="text-sm font-semibold text-slate-800">아직 저장된 분석이 없습니다.</p>
            <p className="mt-2 text-sm text-slate-500">상단의 &quot;합격률 분석하기&quot; 버튼으로 첫 분석을 시작해보세요.</p>
            <button
              type="button"
              onClick={openInputModal}
              className="mt-5 rounded-2xl bg-[#071a36] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#102a52]"
            >
              첫 분석 시작하기
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {savedAnalyses.map((item) => (
              <article key={item.id} className="group rounded-3xl border border-slate-200 bg-white p-5 shadow-[0_14px_34px_rgba(15,23,42,0.05)] transition hover:-translate-y-0.5 hover:border-[#bfdbfe] hover:shadow-[0_18px_42px_rgba(15,23,42,0.08)]">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <div className="min-w-[112px] rounded-2xl bg-[#eef6ff] px-4 py-3">
                    <p className="text-xs font-semibold text-[#094cb2]">매칭 점수</p>
                    <p className="mt-1 text-3xl font-bold tracking-tight text-[#071a36]">
                      {item.total_score}
                      <span className="ml-1 text-base font-semibold text-slate-500">점</span>
                    </p>
                    <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white">
                      <div className="h-full rounded-full bg-[#094cb2]" style={{ width: `${getScorePercent(item.total_score)}%` }} />
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDeleteSavedAnalysis(item)}
                    disabled={deletingId === item.id}
                    className="rounded-full bg-rose-50 px-3 py-1.5 text-xs font-semibold text-rose-600 transition hover:bg-rose-100 disabled:opacity-50"
                  >
                    {deletingId === item.id ? "삭제 중..." : "삭제"}
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectedAnalysis(item);
                    setShowDetailModal(true);
                  }}
                  className="w-full rounded-2xl text-left outline-none transition focus-visible:ring-2 focus-visible:ring-[#bfdbfe]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <p className="line-clamp-2 text-lg font-bold leading-7 text-slate-950">{item.job_title}</p>
                    <span className="shrink-0 rounded-full bg-[#fff1e6] px-3 py-1 text-xs font-semibold text-[#c94f12]">등급 {item.grade}</span>
                  </div>
                  <p className="mt-3 line-clamp-2 min-h-[40px] text-sm leading-5 text-slate-500">{item.summary}</p>
                  <div className="mt-5 flex items-center justify-between border-t border-slate-100 pt-4">
                    <p className="text-xs text-slate-400">{formatDateTime(item.created_at)}</p>
                    <span className="rounded-full bg-[#eef6ff] px-3 py-1.5 text-xs font-semibold text-[#094cb2] transition group-hover:bg-[#dbeafe]">상세 보기</span>
                  </div>
                </button>
              </article>
            ))}
          </div>
        )}
      </div>

      <MatchAnalysisInputModal
        open={showInputModal}
        onClose={() => setShowInputModal(false)}
        analysisMode={analysisMode}
        onSelectResumeMode={async () => {
          setAnalysisMode("resume");
          setSelectedResumeId("");
          await loadResumeOptions();
        }}
        onSelectActivityMode={() => {
          setAnalysisMode("activity");
          setSelectedResumeId("");
        }}
        companyName={companyName}
        onCompanyNameChange={setCompanyName}
        positionName={positionName}
        onPositionNameChange={setPositionName}
        imageFiles={imageFiles}
        addImageFiles={addImageFiles}
        clearImageFiles={clearImageFiles}
        removeImageFile={removeImageFile}
        extracting={extracting}
        onExtractImage={handleExtractImage}
        pdfFile={pdfFile}
        onPdfFileChange={setPdfFile}
        onExtractPdf={handleExtractPdf}
        jobPosting={jobPosting}
        onJobPostingChange={setJobPosting}
        error={error}
        resumeOptions={resumeOptions}
        selectedResumeId={selectedResumeId}
        onSelectedResumeIdChange={setSelectedResumeId}
        loadingResumes={loadingResumes}
        loadingAnalyze={loadingAnalyze}
        onAnalyze={handleAnalyze}
      />

      <MatchAnalysisDetailModal
        open={showDetailModal}
        selectedAnalysis={selectedAnalysis}
        savedAnalyses={savedAnalyses}
        deletingId={deletingId}
        onClose={() => setShowDetailModal(false)}
        onDelete={handleDeleteSavedAnalysis}
      />
    </main>
  );
}
