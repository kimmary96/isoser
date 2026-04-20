import type { ReactNode } from "react";

import type { Program } from "@/lib/types";

export type CompareRow = {
  label: string;
  render: (program: Program | null) => ReactNode;
  isEmpty?: (program: Program | null) => boolean;
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

function formatBooleanLabel(
  value: boolean | null | undefined,
  labels: { true: string; false: string; missing: string }
): string {
  if (value === true) return labels.true;
  if (value === false) return labels.false;
  return labels.missing;
}

function getProgramSummary(program: Program | null): string {
  if (!program) return "정보 없음";
  if (typeof program.summary === "string" && program.summary.trim()) return program.summary.trim();
  if (typeof program.description === "string" && program.description.trim()) return program.description.trim();
  return "정보 없음";
}

function getProgramDescription(program: Program | null): string {
  if (!program) return "정보 없음";
  if (typeof program.description === "string" && program.description.trim()) return program.description.trim();
  return "정보 없음";
}

export function getLinkHref(program: Program | null): string | null {
  if (!program) return null;
  const candidates = [program.application_url, program.source_url, program.link];
  return candidates.find((value): value is string => typeof value === "string" && value.trim().length > 0) ?? null;
}

function getLinkSummary(program: Program | null): string {
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
        label: "과정 기간",
        render: (program) => (program ? formatDateRange(program.start_date, program.end_date) : "정보 없음"),
      },
      {
        label: "운영 기관",
        render: (program) => (program ? getText(program.provider) : "정보 없음"),
      },
      {
        label: "지역",
        render: (program) => (program ? getText(program.location) : "정보 없음"),
      },
      {
        label: "카테고리",
        render: (program) => (program ? getText(program.category) : "정보 없음"),
      },
    ],
  },
  {
    label: "운영 정보",
    className: "bg-violet-50 text-violet-700",
    rows: [
      {
        label: "지원 유형",
        render: (program) => (program ? getOperationalText(program.support_type) : "정보 없음"),
      },
      {
        label: "수업 방식",
        render: (program) => (program ? getOperationalText(program.teaching_method) : "정보 없음"),
      },
      {
        label: "인증 여부",
        render: (program) =>
          program
            ? formatBooleanLabel(program.is_certified, { true: "인증", false: "미인증", missing: "데이터 미수집" })
            : "정보 없음",
      },
      {
        label: "모집 상태",
        render: (program) =>
          program
            ? formatBooleanLabel(program.is_active, { true: "모집 중", false: "마감 또는 비활성", missing: "데이터 미수집" })
            : "정보 없음",
      },
      {
        label: "지원 링크",
        render: (program) => (program ? getLinkSummary(program) : "정보 없음"),
      },
    ],
  },
  {
    label: "프로그램 개요",
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
        label: "주요 기술 스택",
        extraClassName: "flex flex-wrap gap-2",
        isEmpty: (program) => !program || normalizeTextList(program.skills).length === 0,
        render: (program) => {
          const skills = normalizeTextList(program?.skills);
          if (!program || skills.length === 0) return "정보 없음";
          return skills.map((skill) => (
            <span key={`${program.id}-${skill}`} className="rounded-md border border-blue-200 bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-600">
              {skill}
            </span>
          ));
        },
      },
      {
        label: "태그",
        extraClassName: "flex flex-wrap gap-2",
        isEmpty: (program) => !program || normalizeTextList(program.tags).length === 0,
        render: (program) => {
          const tags = normalizeTextList(program?.tags);
          if (!program || tags.length === 0) return "정보 없음";
          return tags.map((tag) => (
            <span key={`${program.id}-tag-${tag}`} className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
              {tag}
            </span>
          ));
        },
      },
      {
        label: "출처",
        render: (program) => (program ? getText(program.source) : "정보 없음"),
      },
    ],
  },
];
