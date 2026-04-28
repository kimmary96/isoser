import type { MatchRewriteResponse } from "@/lib/types";
import { JobPostingInputPanel } from "../../_components/job-posting-input-panel";
import {
  isResumeRewriteSuggestionApplied,
  type AppliedResumeRewriteLines,
} from "../_lib/resume-rewrite";

type ChatMessage = {
  role: "user" | "ai";
  text: string;
};

type ResumeAssistantSidebarProps = {
  targetJob: string;
  onTargetJobChange: (value: string) => void;
  onCreateResume: () => Promise<void>;
  saving: boolean;
  canCreate: boolean;
  error: string | null;
  jobPostingText: string;
  onJobPostingTextChange: (value: string) => void;
  jobPostingUrl: string;
  onJobPostingUrlChange: (value: string) => void;
  onExtractJobUrl: () => Promise<void>;
  jobImageFiles: File[];
  onAddJobImageFiles: (files: FileList | null) => void;
  onRemoveJobImageFile: (file: File) => void;
  onClearJobImageFiles: () => void;
  jobPdfFile: File | null;
  onJobPdfFileChange: (file: File | null) => void;
  jobPostingExtracting: boolean;
  onExtractJobImages: () => Promise<void>;
  onExtractJobPdf: () => Promise<void>;
  rewriteLoading: boolean;
  rewriteError: string | null;
  rewriteResult: MatchRewriteResponse | null;
  rewriteActivityTitles: Record<string, string>;
  appliedRewriteLines: AppliedResumeRewriteLines;
  canGenerateRewrite: boolean;
  onGenerateRewrite: () => Promise<void>;
  onApplyRewriteSuggestion: (activityId: string, text: string) => void;
  onClearRewriteSuggestion: (activityId: string) => void;
  chatMessages: ChatMessage[];
  chatLoading: boolean;
  chatInput: string;
  onChatInputChange: (value: string) => void;
  onChatSend: () => Promise<void>;
};

export function ResumeAssistantSidebar({
  targetJob,
  onTargetJobChange,
  onCreateResume,
  saving,
  canCreate,
  error,
  jobPostingText,
  onJobPostingTextChange,
  jobPostingUrl,
  onJobPostingUrlChange,
  onExtractJobUrl,
  jobImageFiles,
  onAddJobImageFiles,
  onRemoveJobImageFile,
  onClearJobImageFiles,
  jobPdfFile,
  onJobPdfFileChange,
  jobPostingExtracting,
  onExtractJobImages,
  onExtractJobPdf,
  rewriteLoading,
  rewriteError,
  rewriteResult,
  rewriteActivityTitles,
  appliedRewriteLines,
  canGenerateRewrite,
  onGenerateRewrite,
  onApplyRewriteSuggestion,
  onClearRewriteSuggestion,
  chatMessages,
  chatLoading,
  chatInput,
  onChatInputChange,
  onChatSend,
}: ResumeAssistantSidebarProps) {
  return (
    <div className="flex h-full w-80 flex-shrink-0 flex-col overflow-y-auto border-l border-slate-200 bg-white shadow-[0_12px_32px_rgba(15,23,42,0.04)] 2xl:w-[22rem]">
      <div className="border-b border-slate-100 p-4">
        <div className="flex items-center gap-2 rounded-xl bg-[linear-gradient(135deg,#094cb2,#3b82f6)] px-3 py-2 text-white">
          <span className="text-xs font-bold">✦ PREMIUM AI</span>
          <span className="rounded bg-white/20 px-1.5 py-0.5 text-[10px]">ACTIVE</span>
        </div>
      </div>

      <div className="space-y-2 border-b border-slate-100 p-4">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          문서 제어
        </p>

        <input
          value={targetJob}
          onChange={(e) => onTargetJobChange(e.target.value)}
          placeholder="지원 직무 입력..."
          className="mb-2 w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#094cb2] focus:outline-none"
        />

        <button
          onClick={() => void onCreateResume()}
          disabled={saving || !canCreate}
          className="w-full rounded-xl py-2.5 text-sm font-semibold text-white transition-all disabled:opacity-50"
          style={{ background: "linear-gradient(135deg, #094cb2, #3b82f6)" }}
        >
          {saving ? "저장 중..." : "✦ 문서 생성하기"}
        </button>

        {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
      </div>

      <div className="space-y-3 border-b border-slate-100 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          공고 핏 문장 후보
        </p>

        <JobPostingInputPanel
          text={jobPostingText}
          onTextChange={onJobPostingTextChange}
          extracting={jobPostingExtracting}
          imageFiles={jobImageFiles}
          onAddImageFiles={onAddJobImageFiles}
          onRemoveImageFile={onRemoveJobImageFile}
          onClearImageFiles={onClearJobImageFiles}
          onExtractImages={onExtractJobImages}
          pdfFile={jobPdfFile}
          onPdfFileChange={onJobPdfFileChange}
          onExtractPdf={onExtractJobPdf}
          url={jobPostingUrl}
          onUrlChange={onJobPostingUrlChange}
          onExtractUrl={onExtractJobUrl}
          variant="sidebar"
          textPlacement="top"
          textPlaceholder="채용 공고 내용을 붙여넣거나 아래 URL/파일에서 추출하세요."
        />

        <button
          type="button"
          onClick={() => void onGenerateRewrite()}
          disabled={rewriteLoading || !canGenerateRewrite}
          className="w-full rounded-xl bg-[#071a36] px-3 py-2.5 text-xs font-semibold text-white hover:bg-[#0a2146] disabled:opacity-50"
        >
          {rewriteLoading ? "후보 생성 중..." : "선택 성과로 문장 후보 생성"}
        </button>

        {rewriteError && <p className="text-[11px] leading-relaxed text-red-500">{rewriteError}</p>}

        {rewriteResult && (
          <div className="space-y-2">
            <div className="rounded-xl bg-[#eef6ff] p-2 text-[11px] leading-relaxed text-[#094cb2]">
              {rewriteResult.job_analysis_summary}
              {rewriteResult.fallback_used && (
                <span className="mt-1 block text-[#094cb2]">기본 코칭 기준 fallback 포함</span>
              )}
            </div>

            {rewriteResult.activity_rewrites.map((activityRewrite) => {
              const activityApplied = Boolean(
                appliedRewriteLines[activityRewrite.activity_id]?.length
              );

              return (
                <div
                  key={activityRewrite.activity_id}
                  className="rounded-xl border border-slate-100 bg-slate-50 p-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <p className="min-w-0 truncate text-[11px] font-semibold text-slate-700">
                      {rewriteActivityTitles[activityRewrite.activity_id] ||
                        activityRewrite.activity_id}
                    </p>
                    {activityApplied && (
                      <button
                        type="button"
                        onClick={() => onClearRewriteSuggestion(activityRewrite.activity_id)}
                        className="shrink-0 text-[10px] font-medium text-slate-400 hover:text-slate-700"
                      >
                        적용 해제
                      </button>
                    )}
                  </div>
                  <div className="mt-2 space-y-2">
                    {activityRewrite.suggestions.map((suggestion, index) => {
                      const suggestionApplied = isResumeRewriteSuggestionApplied(
                        appliedRewriteLines,
                        activityRewrite.activity_id,
                        suggestion.text
                      );

                      return (
                        <div
                          key={`${activityRewrite.activity_id}-${suggestion.focus}-${index}`}
                          className="rounded-lg bg-white p-2"
                        >
                          <p className="text-[11px] leading-relaxed text-slate-700">
                            {suggestion.text}
                          </p>
                          <div className="mt-1 flex flex-wrap gap-1">
                            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-500">
                              {suggestion.section}
                            </span>
                            <span className="rounded-full bg-[#eef6ff] px-1.5 py-0.5 text-[10px] text-[#094cb2]">
                              {suggestion.focus}
                            </span>
                          </div>
                          <p className="mt-1 text-[10px] leading-relaxed text-slate-400">
                            {suggestion.rationale}
                          </p>
                          <button
                            type="button"
                            onClick={() =>
                              onApplyRewriteSuggestion(
                                activityRewrite.activity_id,
                                suggestion.text
                              )
                            }
                            disabled={suggestionApplied}
                            className="mt-2 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-[11px] font-medium text-slate-600 hover:border-blue-200 hover:bg-[#eef6ff] hover:text-[#094cb2] disabled:border-blue-100 disabled:bg-[#eef6ff] disabled:text-[#094cb2]"
                          >
                            {suggestionApplied ? "미리보기 적용됨" : "미리보기에 적용"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          ✦ AI 조립 어시스턴트
        </p>

        <div className="mb-3 min-h-[120px] flex-1 space-y-2 overflow-y-auto">
          {chatMessages.length === 0 && (
            <p className="text-[11px] leading-relaxed text-slate-400">
              선택한 성과 카드를 분석하여 채용 공고의 핵심 키워드에 맞춰 문장을 최적화할까요?
            </p>
          )}
          {chatMessages.map((message, index) => (
            <div
              key={`${message.role}-${index}`}
              className={`rounded-xl p-2 text-[11px] leading-relaxed ${
                message.role === "user"
                  ? "ml-4 bg-[#eef6ff] text-right text-[#094cb2]"
                  : "mr-4 bg-slate-50 text-slate-700"
              }`}
            >
              {message.text}
            </div>
          ))}
          {chatLoading && (
            <div className="rounded-xl bg-slate-50 p-2 text-[11px] text-slate-400">
              분석 중...
            </div>
          )}
        </div>

        <div className="flex gap-2 border-t border-slate-100 pt-3">
          <textarea
            value={chatInput}
            onChange={(e) => onChatInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void onChatSend();
              }
            }}
            placeholder="AI에게 개선을 요청하세요..."
            rows={3}
            className="flex-1 resize-none rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-[#094cb2] focus:outline-none"
          />
          <button
            onClick={() => void onChatSend()}
            disabled={chatLoading || !chatInput.trim()}
            className="self-end rounded-xl bg-[#071a36] px-3 py-2 text-xs font-medium text-white hover:bg-[#0a2146] disabled:opacity-50"
          >
            전송
          </button>
        </div>
      </div>
    </div>
  );
}
