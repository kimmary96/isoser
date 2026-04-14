"use client";

import { useEffect, useState } from "react";

import { analyzeMatch, extractJobImage, extractJobPdf, getCompanyInsight } from "@/lib/api/backend";
import type { CompanyInsightResponse, MatchResult } from "@/lib/types";
import { useMatchPage, type AnalysisMode, type ResumeOption, type SavedAnalysisCard } from "./_hooks/use-match-page";

type DetailedScore = {
  key: string;
  label: string;
  score: number;
  max_score: number;
  grade: string;
  reason: string;
};

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

function ResultDetail({
  result,
  jobTitle,
  jobPosting,
}: {
  result: MatchResult;
  jobTitle: string;
  jobPosting: string;
}) {
  const detailedScores = (result?.detailed_scores ?? []) as DetailedScore[];
  const [companyInsight, setCompanyInsight] = useState<CompanyInsightResponse | null>(null);
  const [insightLoading, setInsightLoading] = useState(false);
  const [insightError, setInsightError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const run = async () => {
      const companyName = (jobTitle || "").split(" ").slice(0, 1).join(" ").trim();
      if (!companyName) return;

      setInsightLoading(true);
      setInsightError(null);
      try {
        const data = await getCompanyInsight({ company_name: companyName });
        if (mounted) setCompanyInsight(data);
      } catch (e) {
        if (mounted) {
          setInsightError(e instanceof Error ? e.message : "기업 정보 조회 실패");
          setCompanyInsight(null);
        }
      } finally {
        if (mounted) setInsightLoading(false);
      }
    };
    run();
    return () => {
      mounted = false;
    };
  }, [jobTitle, jobPosting]);

  const badgeClass = (status: "good" | "normal" | "caution") =>
    status === "good"
      ? "bg-green-100 text-green-700"
      : status === "caution"
        ? "bg-red-100 text-red-700"
        : "bg-gray-100 text-gray-700";

  return (
    <div className="space-y-5">
      <div className="rounded-xl bg-slate-900 p-5 text-white">
        <p className="text-sm text-slate-300">매칭 점수</p>
        <div className="mt-2 flex items-end gap-2">
          <p className="text-5xl font-bold">{result.total_score}</p>
          <p className="pb-1 text-lg text-slate-300">/ 100</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">등급 {result.grade}</span>
          <span className="rounded-full bg-cyan-400/20 px-3 py-1 text-xs font-semibold text-cyan-100">
            {result.support_recommendation}
          </span>
        </div>
      </div>

      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <p className="text-sm font-semibold text-gray-800">한 줄 총평</p>
        <p className="mt-2 text-sm leading-6 text-gray-700">{result.summary}</p>
      </section>

      {detailedScores.length > 0 && (
        <section className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="mb-3 text-sm font-semibold text-gray-800">매칭 점수 상세</p>
          <div className="space-y-3">
            {detailedScores.map((item) => (
              <div key={item.key} className="rounded-lg border border-gray-200 p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-gray-900">{item.label}</p>
                    <p className="mt-1 text-xs leading-5 text-gray-500">{item.reason}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-gray-900">
                      {item.score} / {item.max_score}
                    </p>
                    <span className="mt-1 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {item.grade}
                    </span>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
                  <div
                    className="h-full rounded-full bg-black"
                    style={{ width: `${(item.score / item.max_score) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {(result.matched_keywords?.length > 0 || result.missing_keywords?.length > 0) && (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {result.matched_keywords?.length > 0 && (
            <div className="rounded-xl border border-green-100 bg-green-50 p-4">
              <p className="text-xs font-semibold text-green-700">보유 키워드</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {result.matched_keywords.map((kw) => (
                  <span key={kw} className="rounded bg-white px-2 py-0.5 text-xs text-green-800">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}

          {result.missing_keywords?.length > 0 && (
            <div className="rounded-xl border border-red-100 bg-red-50 p-4">
              <p className="text-xs font-semibold text-red-700">보완 키워드</p>
              <div className="mt-2 flex flex-wrap gap-1">
                {result.missing_keywords.map((kw) => (
                  <span key={kw} className="rounded bg-white px-2 py-0.5 text-xs text-red-800">
                    {kw}
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      <section className="rounded-xl border border-indigo-100 bg-indigo-50 p-4">
        <div className="flex items-center justify-between gap-2">
          <p className="text-sm font-semibold text-indigo-900">기업 정보 요약 (베타)</p>
          <span className="rounded bg-white px-2 py-0.5 text-[11px] text-indigo-700">웹 검색 기반 요약</span>
        </div>

        {insightLoading ? (
          <p className="mt-3 text-sm text-gray-600">기업 정보를 검색하는 중...</p>
        ) : insightError ? (
          <p className="mt-3 text-sm text-red-600">{insightError}</p>
        ) : companyInsight ? (
          <div className="mt-3 space-y-3">
            <p className="text-sm text-gray-700">{companyInsight.summary}</p>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              {companyInsight.signals.map((signal) => (
                <div key={signal.key} className="rounded-lg bg-white p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs text-gray-500">{signal.label}</p>
                    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${badgeClass(signal.status)}`}>
                      {signal.status_text}
                    </span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-gray-600">{signal.reason}</p>
                </div>
              ))}
            </div>
            {companyInsight.sources?.length > 0 && (
              <div className="rounded-lg border border-indigo-100 bg-white p-3">
                <p className="text-xs font-semibold text-gray-700">참고 출처</p>
                <ul className="mt-2 space-y-2">
                  {companyInsight.sources.slice(0, 3).map((src) => (
                    <li key={src.url} className="text-xs text-gray-600">
                      <a href={src.url} target="_blank" rel="noreferrer" className="font-medium text-blue-700 hover:underline">
                        {src.title || src.url}
                      </a>
                      {src.snippet ? <p className="mt-1 text-gray-500">{src.snippet}</p> : null}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <p className="text-xs leading-5 text-gray-600">{companyInsight.note}</p>
          </div>
        ) : (
          <p className="mt-3 text-sm text-gray-600">기업 정보가 없습니다.</p>
        )}
      </section>
    </div>
  );
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
            아직 저장된 분석이 없습니다. 우측 상단의 "합격률 분석하기" 버튼으로 첫 분석을 시작해보세요.
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

      {showInputModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div className="max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <h2 className="text-2xl font-bold text-gray-900">공고 입력</h2>
              <button
                type="button"
                onClick={() => setShowInputModal(false)}
                className="rounded-md px-2 py-1 text-2xl text-gray-500 hover:bg-gray-100"
                aria-label="닫기"
              >
                ×
              </button>
            </div>

            <div className="space-y-4 px-6 py-5">
              <section className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-semibold text-gray-800">0. 분석 방식 선택</p>
                <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={async () => {
                      setAnalysisMode("resume");
                      setSelectedResumeId("");
                      await loadResumeOptions();
                    }}
                    className={`rounded-xl border p-4 text-left transition ${
                      analysisMode === "resume"
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <p className="text-sm font-semibold text-gray-900">이력서로 분석하기</p>
                    <p className="mt-1 text-xs text-gray-500">저장된 이력서의 활동만 기준으로 분석합니다.</p>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAnalysisMode("activity");
                      setSelectedResumeId("");
                    }}
                    className={`rounded-xl border p-4 text-left transition ${
                      analysisMode === "activity"
                        ? "border-blue-500 bg-blue-50"
                        : "border-gray-200 bg-white hover:border-gray-300"
                    }`}
                  >
                    <p className="text-sm font-semibold text-gray-900">내 활동으로 분석하기</p>
                    <p className="mt-1 text-xs text-gray-500">현재 공개된 모든 활동 기준으로 분석합니다.</p>
                  </button>
                </div>

                {analysisMode === "resume" && (
                  <div className="mt-3 rounded-lg border border-gray-200 bg-white p-3">
                    <p className="mb-2 text-xs font-semibold text-gray-700">분석할 이력서 선택</p>
                    {loadingResumes ? (
                      <p className="text-xs text-gray-500">이력서 목록을 불러오는 중...</p>
                    ) : resumeOptions.length === 0 ? (
                      <p className="text-xs text-gray-500">저장된 이력서가 없습니다. 먼저 이력서를 생성해 주세요.</p>
                    ) : (
                      <select
                        value={selectedResumeId}
                        onChange={(e) => setSelectedResumeId(e.target.value)}
                        className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                      >
                        <option value="">이력서를 선택해 주세요</option>
                        {resumeOptions.map((resume) => (
                          <option key={resume.id} value={resume.id}>
                            {resume.title}
                            {resume.target_job ? ` · ${resume.target_job}` : ""}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </section>

              <section className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-semibold text-gray-800">1. 회사명과 직무명 입력</p>
                <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-700">
                      회사명 <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={companyName}
                      onChange={(e) => setCompanyName(e.target.value)}
                      placeholder="회사명을 입력해 주세요"
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-xs font-semibold text-gray-700">
                      직무명 <span className="text-red-500">*</span>
                    </label>
                    <input
                      value={positionName}
                      onChange={(e) => setPositionName(e.target.value)}
                      placeholder="직무명을 입력해 주세요"
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                    />
                  </div>
                </div>
              </section>

              <section className="rounded-xl border border-gray-200 bg-gray-50 p-4">
                <p className="text-sm font-semibold text-gray-800">2. 공고 업로드</p>
                <div className="mt-3 space-y-3">
                  <input
                    type="file"
                    multiple
                    accept="image/png,image/jpeg,image/jpg,image/webp"
                    onChange={(e) => addImageFiles(e.target.files)}
                    className="block w-full text-sm text-gray-700"
                  />
                  {imageFiles.length > 0 && (
                    <div className="rounded-lg border border-gray-200 bg-white p-2">
                      <div className="mb-2 flex items-center justify-between">
                        <p className="text-xs text-gray-600">{imageFiles.length}개 이미지 선택됨</p>
                        <button
                          type="button"
                          onClick={clearImageFiles}
                          className="text-xs font-medium text-gray-500 hover:text-gray-700"
                        >
                          전체 비우기
                        </button>
                      </div>
                      <ul className="space-y-1">
                        {imageFiles.map((file) => (
                          <li key={`${file.name}-${file.size}-${file.lastModified}`} className="flex items-center justify-between gap-2">
                            <span className="truncate text-xs text-gray-600">{file.name}</span>
                            <button
                              type="button"
                              onClick={() => removeImageFile(file)}
                              className="shrink-0 text-xs font-medium text-red-500 hover:text-red-700"
                            >
                              제거
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={handleExtractImage}
                    disabled={extracting || imageFiles.length === 0}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {extracting ? "이미지 공고 추출 중..." : "이미지(여러 장) 공고 텍스트 추출"}
                  </button>
                  <input
                    type="file"
                    accept="application/pdf"
                    onChange={(e) => setPdfFile(e.target.files?.[0] ?? null)}
                    className="block w-full text-sm text-gray-700"
                  />
                  <button
                    type="button"
                    onClick={handleExtractPdf}
                    disabled={extracting || !pdfFile}
                    className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                  >
                    {extracting ? "PDF 공고 추출 중..." : "PDF 공고 텍스트 추출"}
                  </button>
                </div>

                <textarea
                  value={jobPosting}
                  onChange={(e) => setJobPosting(e.target.value)}
                  placeholder="채용 공고 전문을 붙여넣어 주세요."
                  rows={12}
                  className="mt-3 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
                />
              </section>

              {error && <p className="text-sm text-red-600">{error}</p>}
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-gray-100 px-6 py-4">
              <button
                type="button"
                onClick={() => setShowInputModal(false)}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                취소
              </button>
              <button
                type="button"
                onClick={handleAnalyze}
                disabled={
                  loadingAnalyze ||
                  !jobPosting.trim() ||
                  !companyName.trim() ||
                  !positionName.trim() ||
                  !analysisMode ||
                  (analysisMode === "resume" && !selectedResumeId)
                }
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loadingAnalyze ? "분석 중..." : "합격률 분석하기"}
              </button>
            </div>
          </div>
        </div>
      )}

      {showDetailModal && selectedAnalysis && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[92vh] w-full max-w-5xl overflow-y-auto rounded-2xl border border-gray-200 bg-white">
            <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{selectedAnalysis.job_title}</h3>
                <p className="mt-1 text-xs text-gray-500">{formatDateTime(selectedAnalysis.created_at)}</p>
              </div>
              <button
                type="button"
                onClick={() => setShowDetailModal(false)}
                className="rounded-md px-2 py-1 text-2xl text-gray-500 hover:bg-gray-100"
                aria-label="닫기"
              >
                ×
              </button>
            </div>

            <div className="px-6 py-5">
              {savedAnalyses.some((item) => item.id === selectedAnalysis.id) && (
                <div className="mb-4 flex justify-end">
                  <button
                    type="button"
                    onClick={() => handleDeleteSavedAnalysis(selectedAnalysis)}
                    disabled={deletingId === selectedAnalysis.id}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    {deletingId === selectedAnalysis.id ? "삭제 중..." : "이 분석 삭제"}
                  </button>
                </div>
              )}
              {selectedAnalysis.result ? (
                <ResultDetail
                  result={selectedAnalysis.result}
                  jobTitle={selectedAnalysis.job_title}
                  jobPosting={selectedAnalysis.job_posting}
                />
              ) : (
                <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
                  <p className="text-sm font-semibold text-gray-800">저장된 분석 요약</p>
                  <p className="mt-2 text-sm text-gray-700">{selectedAnalysis.summary}</p>
                  <p className="mt-3 text-sm text-gray-500">총점 {selectedAnalysis.total_score}점 · 등급 {selectedAnalysis.grade}</p>
                  <p className="mt-3 text-xs text-gray-400">
                    상세 데이터가 없는 과거 분석입니다. 새로 분석하면 상세 결과까지 카드에 저장됩니다.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
