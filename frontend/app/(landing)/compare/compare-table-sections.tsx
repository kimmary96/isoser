import type { ReactNode } from "react";

import { formatCompareDateLabel, getCompareOperationalText } from "./compare-formatters";
import {
  getApplicationPeriod,
  getApplicationMethodLabel,
  getCapacityLabel,
  getCategoryLabel,
  getCompareKeywords,
  getContactLabel,
  getDeadlineLabel,
  getDeadlineTone,
  getEligibilityLabel,
  getFeeLabel,
  hasCompareIntroContent,
  getLinkSummary,
  getLocationLabel,
  getNcsLabel,
  getParticipationLabel,
  getProgramDescription,
  getProgramPeriod,
  getProgramSummary,
  getProviderLabel,
  getRatingLabel,
  getSelectionProcessLabel,
  getSourceLabel,
  getSupportTypeLabel,
  getSupportAmountLabel,
  type CompareProgram,
} from "./compare-value-getters";

export type CompareRow = {
  label: string;
  render: (program: CompareProgram | null) => ReactNode;
  isEmpty?: (program: CompareProgram | null) => boolean;
  extraClassName?: string;
};

export type CompareSection = {
  label: string;
  className: string;
  note?: string;
  isVisible?: (programs: Array<CompareProgram | null>) => boolean;
  rows: CompareRow[];
};

export function CompareSectionHeader({
  label,
  className,
  note,
}: {
  label: string;
  className: string;
  note?: string;
}) {
  return (
    <div className={`col-span-4 flex items-center gap-2 border-b border-slate-200 px-5 py-3 text-xs font-semibold ${className}`}>
      <span>{label}</span>
      {note ? <span className="text-[11px] font-medium text-rose-500">{note}</span> : null}
    </div>
  );
}

export function ValueCell({
  children,
  winner,
  empty = false,
  extraClassName = "",
}: {
  children: ReactNode;
  winner: boolean;
  empty?: boolean;
  extraClassName?: string;
}) {
  return (
    <div
      className={`min-w-0 border-b border-r border-slate-200 px-4 py-3 text-sm ${
        winner ? "bg-orange-50/60" : "bg-white"
      } ${empty ? "text-slate-400" : "text-slate-700"} ${extraClassName}`}
    >
      {children}
    </div>
  );
}

export const compareSections: CompareSection[] = [
  {
    label: "기본 정보",
    className: "bg-slate-50 text-slate-600",
    rows: [
      {
        label: "마감일",
        render: (program) =>
          program ? (
            <span className={getDeadlineTone(program.days_left)}>
              {getDeadlineLabel(program.days_left)} {program.deadline ? `· ${formatCompareDateLabel(program.deadline)}` : ""}
            </span>
          ) : (
            "정보 없음"
          ),
      },
      {
        label: "운영 주체",
        render: getProviderLabel,
      },
      {
        label: "지역",
        render: getLocationLabel,
      },
      {
        label: "과정 분류",
        render: getCategoryLabel,
      },
      {
        label: "NCS",
        render: getNcsLabel,
      },
      {
        label: "운영기관 원천",
        render: getSourceLabel,
      },
    ],
  },
  {
    label: "일정",
    className: "bg-sky-50 text-sky-700",
    rows: [
      {
        label: "신청 기간",
        render: getApplicationPeriod,
      },
      {
        label: "교육/운영 기간",
        render: getProgramPeriod,
      },
      {
        label: "일정 요약",
        render: (program) => (program ? getCompareOperationalText(program.detail?.schedule_text) : "정보 없음"),
      },
      {
        label: "참여 시간",
        render: getParticipationLabel,
      },
    ],
  },
  {
    label: "비용·지원",
    className: "bg-emerald-50 text-emerald-700",
    rows: [
      {
        label: "훈련비",
        render: getFeeLabel,
      },
      {
        label: "자부담금",
        render: getSupportAmountLabel,
      },
      {
        label: "지원/사업 유형",
        render: getSupportTypeLabel,
      },
      {
        label: "지원 링크",
        render: (program) => (program ? getLinkSummary(program) : "정보 없음"),
      },
    ],
  },
  {
    label: "대상·모집",
    className: "bg-orange-50 text-orange-700",
    rows: [
      {
        label: "지원 대상",
        render: getEligibilityLabel,
      },
      {
        label: "신청 방법",
        render: getApplicationMethodLabel,
      },
      {
        label: "선발 절차",
        render: getSelectionProcessLabel,
      },
      {
        label: "모집/정원",
        render: getCapacityLabel,
      },
      {
        label: "만족도",
        render: getRatingLabel,
      },
      {
        label: "문의",
        render: getContactLabel,
      },
    ],
  },
  {
    label: "소개",
    className: "bg-blue-50 text-blue-700",
    isVisible: hasCompareIntroContent,
    rows: [
      {
        label: "한줄 요약",
        isEmpty: (program) => getProgramSummary(program) === "정보 없음",
        render: (program) =>
          program ? <span className="line-clamp-2 break-words">{getProgramSummary(program)}</span> : "정보 없음",
      },
      {
        label: "상세 설명",
        isEmpty: (program) => getProgramDescription(program) === "정보 없음",
        render: (program) =>
          program ? <span className="line-clamp-3 break-words">{getProgramDescription(program)}</span> : "정보 없음",
      },
      {
        label: "수집 키워드",
        extraClassName: "flex flex-wrap gap-2",
        isEmpty: (program) => getCompareKeywords(program).length === 0,
        render: (program) => {
          const keywords = getCompareKeywords(program);
          if (!program || keywords.length === 0) return "정보 없음";
          return keywords.map((keyword) => (
            <span key={`${program.id}-${keyword}`} className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600">
              {keyword}
            </span>
          ));
        },
      },
    ],
  },
];
