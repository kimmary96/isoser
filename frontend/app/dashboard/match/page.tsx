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
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">합격률 분석하기</h1>
            <p className="mt-1 text-sm text-gray-500">관심 있는 공고의 합격 확률을 지금 확인해보세요.</p>
          </div>
          <button
            type="button"
            onClick={openInputModal}
            className="rounded-lg bg-black px-5 py-3 text-sm font-semibold text-white hover:bg-gray-800"
          >
            합격률 분석하기
          </button>
        </div>

        {saveNotice && <p className="mb-4 text-sm text-gray-600">{saveNotice}</p>}

        {loadingList ? (
          <div className="rounded-xl border border-gray-200 bg-white p-6 text-sm text-gray-500">저장된 분석을 불러오는 중...</div>
        ) : savedAnalyses.length === 0 ? (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-sm text-gray-400">
            아직 저장된 분석이 없습니다. 우측 상단의 &quot;합격률 분석하기&quot; 버튼으로 첫 분석을 시작해보세요.
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {savedAnalyses.map((item) => (
              <div key={item.id} className="rounded-2xl border border-gray-200 bg-white p-5 transition-shadow hover:shadow-md">
                <div className="mb-2 flex items-start justify-end">
                  <button
                    type="button"
                    onClick={() => handleDeleteSavedAnalysis(item)}
                    disabled={deletingId === item.id}
                    className="rounded-md px-2 py-1 text-xs font-medium text-red-500 hover:bg-red-50 disabled:opacity-50"
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
                  className="w-full text-left"
                >
                  <p className="text-4xl font-bold text-sky-500">
                    {item.total_score}
                    <span className="text-2xl">점</span>
                  </p>
                  <p className="mt-3 line-clamp-2 text-xl font-semibold text-gray-900">{item.job_title}</p>
                  <p className="mt-1 text-sm text-gray-500">등급 {item.grade}</p>
                  <p className="mt-8 text-sm text-gray-400">{formatDateTime(item.created_at)}</p>
                </button>
              </div>
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
