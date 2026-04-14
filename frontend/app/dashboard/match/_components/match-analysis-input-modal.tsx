"use client";

import { ModalShell } from "../../_components/modal-shell";
import type { AnalysisMode, ResumeOption } from "../_hooks/use-match-page";

export function MatchAnalysisInputModal({
  open,
  onClose,
  analysisMode,
  onSelectResumeMode,
  onSelectActivityMode,
  companyName,
  onCompanyNameChange,
  positionName,
  onPositionNameChange,
  imageFiles,
  addImageFiles,
  clearImageFiles,
  removeImageFile,
  extracting,
  onExtractImage,
  pdfFile,
  onPdfFileChange,
  onExtractPdf,
  jobPosting,
  onJobPostingChange,
  error,
  resumeOptions,
  selectedResumeId,
  onSelectedResumeIdChange,
  loadingResumes,
  loadingAnalyze,
  onAnalyze,
}: {
  open: boolean;
  onClose: () => void;
  analysisMode: AnalysisMode;
  onSelectResumeMode: () => Promise<void>;
  onSelectActivityMode: () => void;
  companyName: string;
  onCompanyNameChange: (value: string) => void;
  positionName: string;
  onPositionNameChange: (value: string) => void;
  imageFiles: File[];
  addImageFiles: (files: FileList | null) => void;
  clearImageFiles: () => void;
  removeImageFile: (file: File) => void;
  extracting: boolean;
  onExtractImage: () => Promise<void>;
  pdfFile: File | null;
  onPdfFileChange: (file: File | null) => void;
  onExtractPdf: () => Promise<void>;
  jobPosting: string;
  onJobPostingChange: (value: string) => void;
  error: string | null;
  resumeOptions: ResumeOption[];
  selectedResumeId: string;
  onSelectedResumeIdChange: (value: string) => void;
  loadingResumes: boolean;
  loadingAnalyze: boolean;
  onAnalyze: () => Promise<void>;
}) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      maxWidthClassName="max-w-4xl"
      title="공고 입력"
      subtitle="회사명, 직무명, 채용 공고를 입력한 뒤 현재 이력서 또는 활동 기준으로 합격률을 분석합니다."
      bodyClassName="space-y-4 px-6 py-5"
      footer={
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50">
            취소
          </button>
          <button
            type="button"
            onClick={() => void onAnalyze()}
            disabled={loadingAnalyze || !jobPosting.trim() || !companyName.trim() || !positionName.trim() || !analysisMode || (analysisMode === "resume" && !selectedResumeId)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {loadingAnalyze ? "분석 중..." : "합격률 분석하기"}
          </button>
        </div>
      }
    >
      <>
          <section className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-semibold text-gray-800">0. 분석 방식 선택</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void onSelectResumeMode()}
                className={`rounded-xl border p-4 text-left transition ${
                  analysisMode === "resume" ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"
                }`}
              >
                <p className="text-sm font-semibold text-gray-900">이력서로 분석하기</p>
                <p className="mt-1 text-xs text-gray-500">저장된 이력서의 활동만 기준으로 분석합니다.</p>
              </button>
              <button
                type="button"
                onClick={onSelectActivityMode}
                className={`rounded-xl border p-4 text-left transition ${
                  analysisMode === "activity" ? "border-blue-500 bg-blue-50" : "border-gray-200 bg-white hover:border-gray-300"
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
                    onChange={(e) => onSelectedResumeIdChange(e.target.value)}
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
              <input
                value={companyName}
                onChange={(e) => onCompanyNameChange(e.target.value)}
                placeholder="회사명을 입력해 주세요"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
              />
              <input
                value={positionName}
                onChange={(e) => onPositionNameChange(e.target.value)}
                placeholder="직무명을 입력해 주세요"
                className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
              />
            </div>
          </section>

          <section className="rounded-xl border border-gray-200 bg-gray-50 p-4">
            <p className="text-sm font-semibold text-gray-800">2. 공고 업로드</p>
            <div className="mt-3 space-y-3">
              <input type="file" multiple accept="image/png,image/jpeg,image/jpg,image/webp" onChange={(e) => addImageFiles(e.target.files)} className="block w-full text-sm text-gray-700" />
              {imageFiles.length > 0 && (
                <div className="rounded-lg border border-gray-200 bg-white p-2">
                  <div className="mb-2 flex items-center justify-between">
                    <p className="text-xs text-gray-600">{imageFiles.length}개 이미지 선택됨</p>
                    <button type="button" onClick={clearImageFiles} className="text-xs font-medium text-gray-500 hover:text-gray-700">
                      전체 비우기
                    </button>
                  </div>
                  <ul className="space-y-1">
                    {imageFiles.map((file) => (
                      <li key={`${file.name}-${file.size}-${file.lastModified}`} className="flex items-center justify-between gap-2">
                        <span className="truncate text-xs text-gray-600">{file.name}</span>
                        <button type="button" onClick={() => removeImageFile(file)} className="shrink-0 text-xs font-medium text-red-500 hover:text-red-700">
                          제거
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <button type="button" onClick={() => void onExtractImage()} disabled={extracting || imageFiles.length === 0} className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                {extracting ? "이미지 공고 추출 중..." : "이미지(여러 장) 공고 텍스트 추출"}
              </button>
              <input type="file" accept="application/pdf" onChange={(e) => onPdfFileChange(e.target.files?.[0] ?? null)} className="block w-full text-sm text-gray-700" />
              <button type="button" onClick={() => void onExtractPdf()} disabled={extracting || !pdfFile} className="w-full rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50">
                {extracting ? "PDF 공고 추출 중..." : "PDF 공고 텍스트 추출"}
              </button>
            </div>

            <textarea
              value={jobPosting}
              onChange={(e) => onJobPostingChange(e.target.value)}
              placeholder="채용 공고 전문을 붙여넣어 주세요."
              rows={12}
              className="mt-3 w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-gray-400"
            />
          </section>

          {error && <p className="text-sm text-red-600">{error}</p>}
      </>
    </ModalShell>
  );
}
