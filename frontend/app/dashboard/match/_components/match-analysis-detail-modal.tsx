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
      <div className="rounded-xl bg-slate-900 p-5 text-white">
        <p className="text-sm text-slate-300">매칭 점수</p>
        <div className="mt-2 flex items-end gap-2">
          <p className="text-5xl font-bold">{result.total_score}</p>
          <p className="pb-1 text-lg text-slate-300">/ 100</p>
        </div>
        <div className="mt-3 flex flex-wrap gap-2">
          <span className="rounded-full bg-white/15 px-3 py-1 text-xs font-semibold">등급 {result.grade}</span>
          <span className="rounded-full bg-cyan-400/20 px-3 py-1 text-xs font-semibold text-cyan-100">{result.support_recommendation}</span>
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
                    <p className="text-sm font-bold text-gray-900">{item.score} / {item.max_score}</p>
                    <span className="mt-1 inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">{item.grade}</span>
                  </div>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-gray-100">
                  <div className="h-full rounded-full bg-black" style={{ width: `${(item.score / item.max_score) * 100}%` }} />
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
      bodyClassName="px-6 py-5"
    >
      <>
          {savedAnalyses.some((item) => item.id === selectedAnalysis.id) && (
            <div className="mb-4 flex justify-end">
              <button
                type="button"
                onClick={() => void onDelete(selectedAnalysis)}
                disabled={deletingId === selectedAnalysis.id}
                className="rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
              >
                {deletingId === selectedAnalysis.id ? "삭제 중..." : "이 분석 삭제"}
              </button>
            </div>
          )}
          {selectedAnalysis.result ? (
            <ResultDetail result={selectedAnalysis.result} />
          ) : (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5">
              <p className="text-sm font-semibold text-gray-800">저장된 분석 요약</p>
              <p className="mt-2 text-sm text-gray-700">{selectedAnalysis.summary}</p>
              <p className="mt-3 text-sm text-gray-500">총점 {selectedAnalysis.total_score}점 · 등급 {selectedAnalysis.grade}</p>
              <p className="mt-3 text-xs text-gray-400">상세 데이터가 없는 과거 분석입니다. 새로 분석하면 상세 결과까지 카드에 저장됩니다.</p>
            </div>
          )}
      </>
    </ModalShell>
  );
}
