import type { ReactNode } from "react";

import type { ProgramRelevanceItem } from "@/lib/types";

import { COMPARE_COPY } from "./compare-copy";
import { CompareSectionHeader, ValueCell } from "./compare-table-sections";
import { normalizeTextList } from "./compare-formatters";
import type { CompareProgram } from "./compare-value-getters";

type RelevanceState = "empty" | "login" | "loading" | "error" | "ready";

type CompareRelevanceSectionProps = {
  slots: Array<CompareProgram | null>;
  winnerIndex: number;
  isLoggedIn: boolean;
  relevanceLoading: boolean;
  relevanceError: string | null;
  relevanceItems: Record<string, ProgramRelevanceItem>;
};

const FIT_STAGE_MESSAGES = [
  "엄청난 도전과 열정이 필요해요",
  "새로운 가능성을 열어볼 수 있어요",
  "내 커리어에 부스터를 달아줄거에요",
  "성장 방향과 꽤 잘 맞는 훈련이에요",
  "나와 딱맞는 훈련이에요!",
] as const;

const FIT_STAGE_COLORS = [
  "bg-rose-500",
  "bg-orange-400",
  "bg-yellow-300",
  "bg-lime-500",
  "bg-emerald-500",
] as const;

export function getFitStage(score: number | null | undefined): number {
  if (typeof score !== "number" || Number.isNaN(score)) return 1;
  const normalized = Math.max(0, Math.min(1, score));
  if (normalized >= 0.7) return 5;
  if (normalized >= 0.55) return 4;
  if (normalized >= 0.4) return 3;
  if (normalized >= 0.2) return 2;
  return 1;
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
  if (state === "empty") return COMPARE_COPY.fit.fallback.empty;
  if (state === "login") return COMPARE_COPY.fit.fallback.login;
  if (state === "loading") return COMPARE_COPY.fit.fallback.loading;
  if (state === "error") return COMPARE_COPY.fit.fallback.error;
  return COMPARE_COPY.fit.fallback.empty;
}

function normalizeKeyword(value: string): string {
  return value.trim().replace(/\s+/g, " ");
}

function pushUniqueKeyword(target: string[], value: string | null | undefined) {
  const normalized = value ? normalizeKeyword(value) : "";
  if (!normalized || normalized === "정보 없음" || normalized === "데이터 미수집") return;
  if (target.some((item) => item.toLowerCase() === normalized.toLowerCase())) return;
  target.push(normalized);
}

type MatchingKeywordGroups = {
  direct: string[];
  metadata: string[];
};

function getMatchingKeywordGroups(item: ProgramRelevanceItem, program: CompareProgram | null): MatchingKeywordGroups {
  const direct: string[] = [];
  const metadata: string[] = [];
  item.matched_regions.forEach((region) => pushUniqueKeyword(direct, region));
  item.matched_skills.forEach((skill) => pushUniqueKeyword(direct, skill));

  normalizeTextList(program?.skills).slice(0, 4).forEach((keyword) => pushUniqueKeyword(metadata, keyword));
  normalizeTextList(program?.detail?.tech_stack).slice(0, 4).forEach((keyword) => pushUniqueKeyword(metadata, keyword));
  normalizeTextList(program?.display_categories).forEach((keyword) => pushUniqueKeyword(metadata, keyword));
  normalizeTextList(program?.tags).forEach((keyword) => pushUniqueKeyword(metadata, keyword));
  pushUniqueKeyword(metadata, program?.category_detail ?? program?.category ?? null);
  pushUniqueKeyword(metadata, program?.support_type ?? null);
  pushUniqueKeyword(metadata, program?.teaching_method ?? null);

  const directKeySet = new Set(direct.map((keyword) => keyword.toLowerCase()));
  return {
    direct: direct.slice(0, 8),
    metadata: metadata.filter((keyword) => !directKeySet.has(keyword.toLowerCase())).slice(0, 8),
  };
}

function getMatchingKeywords(item: ProgramRelevanceItem, program: CompareProgram | null): string[] {
  const groups = getMatchingKeywordGroups(item, program);
  return [...groups.direct, ...groups.metadata].slice(0, 8);
}

function getCareerComment(item: ProgramRelevanceItem, program: CompareProgram | null): string {
  const keywords = getMatchingKeywords(item, program);
  const primaryKeywords = keywords.slice(0, 3);
  const keywordText = primaryKeywords.length > 0 ? `${primaryKeywords.join(", ")} 역량과 연결되는 과정입니다.` : "내 이력과 연결해 탐색해볼 만한 과정입니다.";

  if (item.fit_label === "높음") {
    return `${keywordText} 이 훈련을 들으면 이미 가진 경험을 더 실무적인 결과물로 확장하고, 지원서에서 바로 설명할 수 있는 프로젝트 근거를 만들기 좋습니다.`;
  }
  if (item.fit_label === "보통") {
    return `${keywordText} 부족한 부분을 보완하면서 관심 직무와 연결된 포트폴리오 소재를 만들 수 있어, 다음 지원 단계의 설득력을 높이는 데 도움이 됩니다.`;
  }
  return `${keywordText} 아직 직접 매칭 신호는 적지만, 새로운 직무 키워드를 확보하고 커리어 방향을 넓혀보는 출발점으로 활용할 수 있습니다.`;
}

function RelevancePercent({ score }: { score: number | null | undefined }) {
  const stage = getFitStage(score);
  const markerLeft = `${((stage - 0.5) / 5) * 100}%`;

  return (
    <div className="w-full">
      <div className="relative h-6 px-1">
        <div className="grid h-2.5 grid-cols-5 gap-1 overflow-hidden rounded-full bg-slate-100 p-0.5 shadow-inner">
          {FIT_STAGE_COLORS.map((color, index) => (
            <span
              key={color}
              className={`${color} h-full rounded-full ${stage === index + 1 ? "opacity-100" : "opacity-45"}`}
            />
          ))}
        </div>
        <span
          className="absolute top-[5px] h-4 w-1.5 -translate-x-1/2 rounded-full bg-slate-950 shadow-sm ring-2 ring-white"
          style={{ left: markerLeft }}
          aria-hidden="true"
        />
      </div>
      <div className="mt-3 flex items-center justify-between gap-3">
        <p className="text-sm font-bold leading-5 text-slate-800">{FIT_STAGE_MESSAGES[stage - 1]}</p>
        <span className="shrink-0 rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
          {stage}/5
        </span>
      </div>
    </div>
  );
}

function KeywordChips({ item, program }: { item: ProgramRelevanceItem; program: CompareProgram | null }) {
  const groups = getMatchingKeywordGroups(item, program);
  if (groups.direct.length === 0 && groups.metadata.length === 0) return <>{COMPARE_COPY.fit.noKeywords}</>;

  const renderGroup = (label: string, keywords: string[], tone: "direct" | "metadata") => {
    if (keywords.length === 0) return null;
    const chipClass =
      tone === "direct"
        ? "border-orange-200 bg-orange-50 text-orange-700"
        : "border-slate-200 bg-slate-50 text-slate-600";
    return (
      <div className="flex flex-wrap content-start items-center gap-2">
        <span className="shrink-0 text-[11px] font-semibold text-slate-500">{label}</span>
        {keywords.map((keyword) => (
          <span
            key={`${item.program_id}-${label}-${keyword}`}
            className={`inline-flex shrink-0 items-center rounded-md border px-2.5 py-1 text-xs font-medium ${chipClass}`}
          >
            {keyword}
          </span>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-2">
      {renderGroup("직접 근거", groups.direct, "direct")}
      {renderGroup("과정 메타", groups.metadata, "metadata")}
    </div>
  );
}

type RelevanceRow = {
  label: string;
  extraClassName?: string;
  render: (item: ProgramRelevanceItem, program: CompareProgram | null) => ReactNode;
};

const relevanceRows: RelevanceRow[] = [
  {
    label: COMPARE_COPY.fit.rows.stage,
    render: (item) => <RelevancePercent score={item.relevance_score} />,
  },
  {
    label: COMPARE_COPY.fit.rows.keywords,
    render: (item, program) => <KeywordChips item={item} program={program} />,
  },
  {
    label: COMPARE_COPY.fit.rows.comment,
    render: (item, program) => <span className="block max-w-prose text-sm leading-6 text-slate-700">{getCareerComment(item, program)}</span>,
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
      <CompareSectionHeader label={COMPARE_COPY.fit.title} className="bg-[#071a36] text-white" note={COMPARE_COPY.fit.note} />

      {relevanceRows.map(({ label, render, extraClassName }) => (
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
                empty={!program}
                extraClassName={extraClassName ?? ""}
              >
                {state === "ready" && item ? render(item, program) : renderRelevanceFallback(state)}
              </ValueCell>
            );
          })}
        </div>
      ))}
    </>
  );
}
