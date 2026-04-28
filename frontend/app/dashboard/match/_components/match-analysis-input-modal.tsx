"use client";

import { JobPostingInputPanel } from "../../_components/job-posting-input-panel";
import { ModalShell } from "../../_components/modal-shell";
import type { AnalysisMode, ResumeOption } from "../_hooks/use-match-page";

const sectionClassName = "rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]";
const fieldClassName = "w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition placeholder:text-slate-400 focus:border-[#094cb2] focus:ring-2 focus:ring-[#bfdbfe]";

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
      maxWidthClassName="max-w-5xl"
      title="공고 입력"
      subtitle="회사명, 직무명, 채용 공고를 입력한 뒤 현재 이력서 또는 활동 기준으로 합격률을 분석합니다."
      bodyClassName="space-y-4 bg-[#f8fbff] px-4 py-4 sm:px-6 sm:py-5"
      scrollBody
      footer={
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-end">
          <button type="button" onClick={onClose} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-600 transition hover:bg-slate-50 sm:w-auto">
            취소
          </button>
          <button
            type="button"
            onClick={() => void onAnalyze()}
            disabled={loadingAnalyze || !jobPosting.trim() || !companyName.trim() || !positionName.trim() || !analysisMode || (analysisMode === "resume" && !selectedResumeId)}
            className="w-full rounded-xl bg-gradient-to-r from-[#094cb2] to-[#3b82f6] px-4 py-2.5 text-sm font-semibold text-white shadow-[0_10px_22px_rgba(9,76,178,0.22)] transition hover:brightness-105 disabled:opacity-50 sm:w-auto"
          >
            {loadingAnalyze ? "분석 중..." : "합격률 분석하기"}
          </button>
        </div>
      }
    >
      <>
          <section className={sectionClassName}>
            <p className="text-sm font-semibold text-slate-900">0. 분석 방식 선택</p>
            <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <button
                type="button"
                onClick={() => void onSelectResumeMode()}
                className={`rounded-xl border p-4 text-left transition ${
                  analysisMode === "resume" ? "border-[#094cb2] bg-[#eef6ff] ring-2 ring-[#bfdbfe]" : "border-slate-200 bg-white hover:border-[#bfdbfe] hover:bg-[#f8fbff]"
                }`}
              >
                <p className="text-sm font-semibold text-slate-900">이력서로 분석하기</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">저장된 이력서의 활동만 기준으로 분석합니다.</p>
              </button>
              <button
                type="button"
                onClick={onSelectActivityMode}
                className={`rounded-xl border p-4 text-left transition ${
                  analysisMode === "activity" ? "border-[#094cb2] bg-[#eef6ff] ring-2 ring-[#bfdbfe]" : "border-slate-200 bg-white hover:border-[#bfdbfe] hover:bg-[#f8fbff]"
                }`}
              >
                <p className="text-sm font-semibold text-slate-900">내 활동으로 분석하기</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">현재 공개된 모든 활동 기준으로 분석합니다.</p>
              </button>
            </div>

            {analysisMode === "resume" && (
              <div className="mt-3 rounded-xl border border-slate-200 bg-[#f8fbff] p-3">
                <p className="mb-2 text-xs font-semibold text-slate-700">분석할 이력서 선택</p>
                {loadingResumes ? (
                  <p className="text-xs text-slate-500">이력서 목록을 불러오는 중...</p>
                ) : resumeOptions.length === 0 ? (
                  <p className="text-xs text-slate-500">저장된 이력서가 없습니다. 먼저 이력서를 생성해 주세요.</p>
                ) : (
                  <select
                    value={selectedResumeId}
                    onChange={(e) => onSelectedResumeIdChange(e.target.value)}
                    className={fieldClassName}
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

          <section className={sectionClassName}>
            <p className="text-sm font-semibold text-slate-900">1. 회사명과 직무명 입력</p>
            <div className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">회사명</span>
                <input
                  value={companyName}
                  onChange={(e) => onCompanyNameChange(e.target.value)}
                  placeholder="회사명을 입력해 주세요"
                  className={fieldClassName}
                />
              </label>
              <label className="block">
                <span className="mb-1.5 block text-xs font-semibold text-slate-600">직무명</span>
                <input
                  value={positionName}
                  onChange={(e) => onPositionNameChange(e.target.value)}
                  placeholder="직무명을 입력해 주세요"
                  className={fieldClassName}
                />
              </label>
            </div>
          </section>

          <section className={sectionClassName}>
            <p className="text-sm font-semibold text-slate-900">2. 공고 업로드</p>
            <div className="mt-3">
              <JobPostingInputPanel
                text={jobPosting}
                onTextChange={onJobPostingChange}
                extracting={extracting}
                imageFiles={imageFiles}
                onAddImageFiles={addImageFiles}
                onRemoveImageFile={removeImageFile}
                onClearImageFiles={clearImageFiles}
                onExtractImages={onExtractImage}
                pdfFile={pdfFile}
                onPdfFileChange={onPdfFileChange}
                onExtractPdf={onExtractPdf}
                variant="modal"
                textPlacement="bottom"
              />
            </div>
          </section>

          {error && <p className="rounded-xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-600">{error}</p>}
      </>
    </ModalShell>
  );
}
