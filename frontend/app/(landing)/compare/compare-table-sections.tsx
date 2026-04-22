import type { ReactNode } from "react";

import type { Program, ProgramDetail } from "@/lib/types";

export type CompareProgram = Program & {
  detail?: ProgramDetail | null;
};

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
  rows: CompareRow[];
};

export function normalizeTextList(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function formatDateLabel(value: string | null | undefined): string {
  if (!value) return "정보 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

function formatDateRange(startDate?: string | null, endDate?: string | null): string {
  if (startDate && endDate) {
    return `${formatDateLabel(startDate)} ~ ${formatDateLabel(endDate)}`;
  }
  if (startDate) {
    return `${formatDateLabel(startDate)} 시작`;
  }
  if (endDate) {
    return `${formatDateLabel(endDate)} 종료`;
  }
  return "데이터 미수집";
}

function getText(value: string | null | undefined): string {
  return typeof value === "string" && value.trim() ? value.trim() : "정보 없음";
}

function getOperationalText(value: string | null | undefined): string {
  return typeof value === "string" && value.trim() ? value.trim() : "데이터 미수집";
}

function getFirstText(...values: Array<string | number | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function getDeadlineLabel(daysLeft?: number | null): string {
  if (typeof daysLeft !== "number") return "정보 없음";
  if (daysLeft < 0) return "마감";
  if (daysLeft === 0) return "D-Day";
  return `D-${daysLeft}`;
}

export function getDeadlineTone(daysLeft?: number | null): string {
  if (typeof daysLeft !== "number") return "text-slate-500";
  if (daysLeft <= 3) return "text-rose-600";
  if (daysLeft <= 7) return "text-orange-500";
  if (daysLeft <= 14) return "text-amber-500";
  return "text-emerald-600";
}

function getProgramSummary(program: CompareProgram | null): string {
  if (!program) return "정보 없음";
  if (typeof program.summary === "string" && program.summary.trim()) return program.summary.trim();
  if (typeof program.detail?.description === "string" && program.detail.description.trim()) return program.detail.description.trim();
  if (typeof program.description === "string" && program.description.trim()) return program.description.trim();
  return "정보 없음";
}

function getProgramDescription(program: CompareProgram | null): string {
  if (!program) return "정보 없음";
  if (typeof program.detail?.description === "string" && program.detail.description.trim()) {
    return program.detail.description.trim();
  }
  if (typeof program.description === "string" && program.description.trim()) return program.description.trim();
  return "정보 없음";
}

function getSourceLabel(program: CompareProgram | null): string {
  if (!program) return "정보 없음";
  return getText(getFirstText(program.source, program.detail?.organizer, program.provider));
}

function getProviderLabel(program: CompareProgram | null): string {
  if (!program) return "정보 없음";
  return getText(getFirstText(program.detail?.provider, program.detail?.organizer, program.provider));
}

function getLocationLabel(program: CompareProgram | null): string {
  if (!program) return "정보 없음";
  return getText(getFirstText(program.detail?.location, program.location));
}

function getApplicationPeriod(program: CompareProgram | null): string {
  if (!program) return "정보 없음";
  const detail = program.detail;
  if (detail?.application_start_date || detail?.application_end_date) {
    return formatDateRange(detail.application_start_date, detail.application_end_date);
  }
  if (program.deadline) return `${formatDateLabel(program.deadline)} 마감`;
  return "데이터 미수집";
}

function getProgramPeriod(program: CompareProgram | null): string {
  if (!program) return "정보 없음";
  const detail = program.detail;
  if (detail?.program_start_date || detail?.program_end_date) {
    return formatDateRange(detail.program_start_date, detail.program_end_date);
  }
  if (program.start_date || program.end_date) return formatDateRange(program.start_date, program.end_date);
  return "데이터 미수집";
}

function formatMoney(value: number | string | null | undefined): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value === 0) return "무료";
    return `${value.toLocaleString("ko-KR")}원`;
  }
  if (typeof value === "string" && value.trim()) {
    const numericValue = Number(value.replace(/[^\d.-]/g, ""));
    if (Number.isFinite(numericValue) && value.trim() !== "") {
      if (numericValue === 0) return "무료";
      return `${numericValue.toLocaleString("ko-KR")}원`;
    }
    return value.trim();
  }
  return null;
}

function getFeeLabel(program: CompareProgram | null): string {
  if (!program) return "정보 없음";
  return formatMoney(program.detail?.fee ?? program.cost) ?? "데이터 미수집";
}

function getSupportAmountLabel(program: CompareProgram | null): string {
  if (!program) return "정보 없음";
  return formatMoney(program.detail?.support_amount ?? program.subsidy_amount) ?? getOperationalText(program.detail?.support_type ?? program.support_type);
}

function getEligibilityLabel(program: CompareProgram | null): string {
  if (!program) return "정보 없음";
  const eligibility = program.detail?.eligibility ?? normalizeTextList(program.tags);
  return eligibility.length > 0 ? eligibility.join(", ") : "데이터 미수집";
}

function getCapacityLabel(program: CompareProgram | null): string {
  if (!program) return "정보 없음";
  const remaining = program.detail?.capacity_remaining;
  const total = program.detail?.capacity_total;
  if (typeof remaining === "number" && typeof total === "number") return `${remaining}/${total}명`;
  if (typeof total === "number") return `${total}명`;
  return "데이터 미수집";
}

function getRatingLabel(program: CompareProgram | null): string {
  if (!program) return "정보 없음";
  return getOperationalText(
    getFirstText(program.detail?.rating_display, program.rating_display, program.detail?.rating, program.rating)
  );
}

function getContactLabel(program: CompareProgram | null): string {
  if (!program) return "정보 없음";
  const detail = program.detail;
  const contact = [detail?.manager_name, detail?.phone, detail?.email].filter(
    (item): item is string => typeof item === "string" && item.trim().length > 0
  );
  return contact.length > 0 ? contact.join(" · ") : "데이터 미수집";
}

export function getLinkHref(program: CompareProgram | null): string | null {
  if (!program) return null;
  const candidates = [program.application_url, program.detail?.source_url, program.source_url, program.link];
  return candidates.find((value): value is string => typeof value === "string" && value.trim().length > 0) ?? null;
}

function getLinkSummary(program: CompareProgram | null): string {
  return getLinkHref(program) ? "바로가기 가능" : "링크 없음";
}

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
              {getDeadlineLabel(program.days_left)} {program.deadline ? `· ${formatDateLabel(program.deadline)}` : ""}
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
        label: "카테고리",
        render: (program) => (program ? getText(program.category) : "정보 없음"),
      },
      {
        label: "출처",
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
        render: (program) => (program ? getOperationalText(program.detail?.schedule_text) : "정보 없음"),
      },
    ],
  },
  {
    label: "비용·지원",
    className: "bg-emerald-50 text-emerald-700",
    rows: [
      {
        label: "비용",
        render: getFeeLabel,
      },
      {
        label: "지원금/혜택",
        render: getSupportAmountLabel,
      },
      {
        label: "지원/사업 유형",
        render: (program) => (program ? getOperationalText(program.detail?.support_type ?? program.support_type) : "정보 없음"),
      },
      {
        label: "지원 링크",
        render: (program) => (program ? getLinkSummary(program) : "정보 없음"),
      },
    ],
  },
  {
    label: "대상·모집",
    className: "bg-violet-50 text-violet-700",
    rows: [
      {
        label: "지원 대상",
        render: getEligibilityLabel,
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
    rows: [
      {
        label: "한줄 요약",
        render: (program) =>
          program ? <span className="line-clamp-2 break-words">{getProgramSummary(program)}</span> : "정보 없음",
      },
      {
        label: "상세 설명",
        render: (program) =>
          program ? <span className="line-clamp-3 break-words">{getProgramDescription(program)}</span> : "정보 없음",
      },
      {
        label: "수집 키워드",
        extraClassName: "flex flex-wrap gap-2",
        isEmpty: (program) =>
          !program ||
          [
            ...normalizeTextList(program.detail?.tech_stack),
            ...normalizeTextList(program.skills),
            ...normalizeTextList(program.detail?.tags),
            ...normalizeTextList(program.tags),
          ].length === 0,
        render: (program) => {
          const keywords = [
            ...normalizeTextList(program?.detail?.tech_stack),
            ...normalizeTextList(program?.skills),
            ...normalizeTextList(program?.detail?.tags),
            ...normalizeTextList(program?.tags),
          ].filter((item, index, items) => items.indexOf(item) === index).slice(0, 8);
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
