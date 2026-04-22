import type { ReactNode } from "react";

import type { ProgramRelevanceItem } from "@/lib/types";

import { CompareSectionHeader, type CompareProgram, ValueCell } from "./compare-table-sections";

type RelevanceState = "empty" | "login" | "loading" | "error" | "ready";

type CompareRelevanceSectionProps = {
  slots: Array<CompareProgram | null>;
  winnerIndex: number;
  isLoggedIn: boolean;
  relevanceLoading: boolean;
  relevanceError: string | null;
  relevanceItems: Record<string, ProgramRelevanceItem>;
};

type RelevanceDetailRow = {
  label: string;
  extraClassName?: string;
  empty?: (item: ProgramRelevanceItem | null, program: CompareProgram | null, isLoggedIn: boolean) => boolean;
  render: (item: ProgramRelevanceItem | null) => ReactNode;
};

function formatPercent(score: number | null | undefined): string {
  if (typeof score !== "number" || Number.isNaN(score)) return "0%";
  return `${Math.round(score * 100)}%`;
}

function ScoreBar({ score }: { score: number | null | undefined }) {
  const width = typeof score === "number" && !Number.isNaN(score) ? Math.max(0, Math.min(100, Math.round(score * 100))) : 0;

  return (
    <div className="w-full">
      <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
        <span>{formatPercent(score)}</span>
      </div>
      <div className="mt-2 h-2.5 w-full overflow-hidden rounded-full bg-slate-100">
        <div className="h-full rounded-full bg-[#F97316]" style={{ width: `${width}%` }} />
      </div>
    </div>
  );
}

function getRelevanceValueState(
  program: CompareProgram | null,
  isLoggedIn: boolean,
  relevanceLoading: boolean,
  relevanceError: string | null
): RelevanceState {
  if (!program) return "empty";
  if (!isLoggedIn) return "login";
  if (relevanceLoading) return "loading";
  if (relevanceError) return "error";
  return "ready";
}

function renderRelevanceFallback(state: RelevanceState): string {
  if (state === "empty") return "정보 없음";
  if (state === "login") return "로그인 후 확인";
  if (state === "loading") return "분석 중";
  if (state === "error") return "불러오기 실패";
  return "정보 없음";
}

const relevanceDetailRows: RelevanceDetailRow[] = [
  {
    label: "적합도 판단",
    render: (item) =>
      item ? (
        <span className="inline-flex rounded-md border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">
          {item.fit_label}
        </span>
      ) : null,
  },
  {
    label: "지원 준비도",
    render: (item) =>
      item ? (
        <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-700">
          {item.readiness_label}
        </span>
      ) : null,
  },
  {
    label: "AI 한줄 요약",
    render: (item) => (item ? <span className="line-clamp-2 break-words">{item.fit_summary}</span> : null),
  },
  {
    label: "보완 포인트",
    extraClassName: "flex flex-wrap gap-2",
    render: (item) =>
      item
        ? item.gap_tags.length > 0
          ? item.gap_tags.map((tag) => (
              <span key={`${item.program_id}-${tag}`} className="rounded-md border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-700">
                {tag}
              </span>
            ))
          : "보완 포인트 없음"
        : null,
  },
];

export function CompareRelevanceSection({
  slots,
  winnerIndex,
  isLoggedIn,
  relevanceLoading,
  relevanceError,
  relevanceItems,
}: CompareRelevanceSectionProps) {
  return (
    <>
      <CompareSectionHeader label="★ AI 적합도" className="bg-[#0A0F1E] text-white" />

      <div className="row contents">
        <div className="border-b border-r border-slate-200 bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600">상태</div>
        {slots.map((program, index) => {
          const state = getRelevanceValueState(program, isLoggedIn, relevanceLoading, relevanceError);
          return (
            <ValueCell key={`relevance-state-${program?.id ?? index}`} winner={winnerIndex === index} empty={!program}>
              {state === "login" ? (
                <span className="inline-flex rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-semibold text-slate-600">
                  로그인 후 확인
                </span>
              ) : state === "loading" ? "분석 중" : state === "error" ? "불러오기 실패" : state === "ready" ? "분석 완료" : "정보 없음"}
            </ValueCell>
          );
        })}
      </div>

      {[
        { label: "종합 관련도", scoreKey: "relevance_score" as const },
        { label: "프로필 키워드 일치도", scoreKey: "skill_match_score" as const },
        { label: "지역 일치도", scoreKey: "region_match_score" as const },
      ].map(({ label, scoreKey }) => (
        <div key={label} className="row contents">
          <div className="border-b border-r border-slate-200 bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600">{label}</div>
          {slots.map((program, index) => {
            const programId = typeof program?.id === "string" ? program.id : "";
            const item = programId ? relevanceItems[programId] : null;
            const score = item?.[scoreKey];
            const state = getRelevanceValueState(program, isLoggedIn, relevanceLoading, relevanceError);
            return (
              <ValueCell key={`${label}-${program?.id ?? index}`} winner={winnerIndex === index} empty={!program}>
                {state === "ready" && item ? <ScoreBar score={score} /> : renderRelevanceFallback(state)}
              </ValueCell>
            );
          })}
        </div>
      ))}

      <div className="row contents">
        <div className="border-b border-r border-slate-200 bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600">매칭된 프로필 키워드</div>
        {slots.map((program, index) => {
          const programId = typeof program?.id === "string" ? program.id : "";
          const item = programId ? relevanceItems[programId] : null;
          const matchedSkills = item?.matched_skills ?? [];
          const state = getRelevanceValueState(program, isLoggedIn, relevanceLoading, relevanceError);
          return (
            <ValueCell
              key={`matched-skills-${program?.id ?? index}`}
              winner={winnerIndex === index}
              empty={!program || (!isLoggedIn && matchedSkills.length === 0)}
              extraClassName="flex flex-wrap gap-2"
            >
              {state !== "ready"
                ? renderRelevanceFallback(state)
                : matchedSkills.length > 0
                  ? matchedSkills.map((skill) => (
                      <span key={`${programId}-${skill}`} className="rounded-md border border-orange-200 bg-orange-50 px-2.5 py-1 text-xs font-medium text-orange-700">
                        {skill}
                      </span>
                    ))
                  : "매칭 키워드 없음"}
            </ValueCell>
          );
        })}
      </div>

      <div className="row contents">
        <div className="border-b border-r border-slate-200 bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600">매칭된 지역</div>
        {slots.map((program, index) => {
          const programId = typeof program?.id === "string" ? program.id : "";
          const item = programId ? relevanceItems[programId] : null;
          const matchedRegions = item?.matched_regions ?? [];
          const state = getRelevanceValueState(program, isLoggedIn, relevanceLoading, relevanceError);
          return (
            <ValueCell
              key={`matched-regions-${program?.id ?? index}`}
              winner={winnerIndex === index}
              empty={!program || (!isLoggedIn && matchedRegions.length === 0)}
              extraClassName="flex flex-wrap gap-2"
            >
              {state !== "ready"
                ? renderRelevanceFallback(state)
                : matchedRegions.length > 0
                  ? matchedRegions.map((region) => (
                      <span key={`${programId}-${region}`} className="rounded-md border border-emerald-200 bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700">
                        {region}
                      </span>
                    ))
                  : "지역 매칭 없음"}
            </ValueCell>
          );
        })}
      </div>

      {relevanceDetailRows.map(({ label, render, empty, extraClassName }) => (
        <div key={label} className="row contents">
          <div className="border-b border-r border-slate-200 bg-slate-100 px-4 py-3 text-sm font-medium text-slate-600">{label}</div>
          {slots.map((program, index) => {
            const programId = typeof program?.id === "string" ? program.id : "";
            const item = programId ? relevanceItems[programId] : null;
            const state = getRelevanceValueState(program, isLoggedIn, relevanceLoading, relevanceError);
            return (
              <ValueCell
                key={`${label}-${program?.id ?? index}`}
                winner={winnerIndex === index}
                empty={empty ? empty(item, program, isLoggedIn) : !program}
                extraClassName={extraClassName ?? ""}
              >
                {state === "ready" && item ? render(item) : renderRelevanceFallback(state)}
              </ValueCell>
            );
          })}
        </div>
      ))}
    </>
  );
}
