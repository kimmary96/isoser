"use client";

import type { MatchResult } from "@/lib/types";
import { ModalShell } from "../../_components/modal-shell";
import type { SavedAnalysisCard } from "../_hooks/use-match-page";

type DetailedScore = {
  key: string;
  label: string;
  score: number;
  max_score: number;
  grade: string;
  reason: string;
};

function getScorePercent(score: number, maxScore: number): number {
  if (maxScore <= 0) return 0;
  return Math.min(100, Math.max(0, (score / maxScore) * 100));
}

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

function ResultDetail({ result }: { result: MatchResult }) {
  const detailedScores = (result?.detailed_scores ?? []) as DetailedScore[];

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-[#102a52] bg-[#071a36] p-5 text-white shadow-[0_18px_44px_rgba(7,26,54,0.22)]">
        <p className="text-sm font-semibold text-blue-100">매칭 점수</p>
        <div className="mt-2 flex items-end gap-2">
          <p className="text-5xl font-bold tracking-tight">{result.total_score}</p>
          <p className="pb-1 text-lg text-blue-100">/ 100</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">등급 {result.grade}</span>
          <span className="rounded-full bg-[#fff1e6] px-3 py-1 text-xs font-semibold text-[#c94f12]">{result.support_recommendation}</span>
        </div>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
        <p className="text-sm font-semibold text-slate-900">한 줄 총평</p>
        <p className="mt-2 text-sm leading-6 text-slate-600">{result.summary}</p>
      </section>

      {detailedScores.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
          <p className="mb-3 text-sm font-semibold text-slate-900">매칭 점수 상세</p>
          <div className="space-y-3">
            {detailedScores.map((item) => (
              <div key={item.key} className="rounded-2xl border border-slate-200 bg-[#f8fbff] p-3">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-sm font-semibold text-slate-900">{item.label}</p>
                    <p className="mt-1 text-xs leading-5 text-slate-500">{item.reason}</p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-bold text-[#071a36]">{item.score} / {item.max_score}</p>
                    <span className="mt-1 inline-flex rounded-full bg-[#fff1e6] px-2.5 py-0.5 text-xs font-semibold text-[#c94f12]">{item.grade}</span>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-200">
                  <div className="h-full rounded-full bg-[#094cb2]" style={{ width: `${getScorePercent(item.score, item.max_score)}%` }} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

export function MatchAnalysisDetailModal({
  open,
  selectedAnalysis,
  savedAnalyses,
  deletingId,
  onClose,
  onDelete,
}: {
  open: boolean;
  selectedAnalysis: SavedAnalysisCard | null;
  savedAnalyses: SavedAnalysisCard[];
  deletingId: string | null;
  onClose: () => void;
  onDelete: (item: SavedAnalysisCard) => Promise<void>;
}) {
  if (!open || !selectedAnalysis) return null;

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      maxWidthClassName="max-w-5xl"
      title={selectedAnalysis.job_title}
      subtitle={formatDateTime(selectedAnalysis.created_at)}
      bodyClassName="bg-[#f8fbff] px-4 py-4 sm:px-6 sm:py-5"
      titleClassName="mt-1 line-clamp-2 text-xl font-bold leading-7 text-slate-900 sm:text-2xl sm:leading-8"
      scrollBody
    >
      <>
          {savedAnalyses.some((item) => item.id === selectedAnalysis.id) && (
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                onClick={() => void onDelete(selectedAnalysis)}
                disabled={deletingId === selectedAnalysis.id}
                className="rounded-xl border border-rose-200 bg-white px-3 py-1.5 text-sm font-semibold text-rose-600 transition hover:bg-rose-50 disabled:opacity-50"
              >
                {deletingId === selectedAnalysis.id ? "삭제 중..." : "이 분석 삭제"}
              </button>
            </div>
          )}
          {selectedAnalysis.result ? (
            <ResultDetail result={selectedAnalysis.result} />
          ) : (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-[0_10px_28px_rgba(15,23,42,0.04)]">
              <p className="text-sm font-semibold text-slate-900">저장된 분석 요약</p>
              <p className="mt-2 text-sm leading-6 text-slate-600">{selectedAnalysis.summary}</p>
              <p className="mt-3 text-sm font-medium text-slate-500">총점 {selectedAnalysis.total_score}점 · 등급 {selectedAnalysis.grade}</p>
              <p className="mt-3 text-xs text-slate-400">상세 데이터가 없는 과거 분석입니다. 새로 분석하면 상세 결과까지 카드에 저장됩니다.</p>
            </div>
          )}
      </>
    </ModalShell>
  );
}
