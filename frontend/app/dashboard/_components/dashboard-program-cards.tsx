"use client";

import Link from "next/link";

import { ProgramDeadlineBadge } from "@/components/programs/program-deadline-badge";
import {
  getProgramCardFitKeywords,
  getProgramCardRelevanceReasons,
  getProgramCardRelevanceBadge,
  getProgramCardScore,
} from "@/lib/program-card-items";
import {
  formatProgramDeadlineDate,
  formatProgramRelevanceText,
  formatProgramScheduleLabel,
  formatProgramSourceLabel,
  getProgramId,
  getProgramPrimaryLink,
} from "@/lib/program-display";
import type { ProgramCardItem, ProgramCardSummary } from "@/lib/types";

function getCardBorderClass(daysLeft: number | null | undefined): string {
  if (typeof daysLeft !== "number" || Number.isNaN(daysLeft) || daysLeft > 14) {
    return "border-l-4 border-l-green-400";
  }

  if (daysLeft <= 7) {
    return "border-l-4 border-l-red-500";
  }

  return "border-l-4 border-l-yellow-400";
}

export function DashboardRecommendationSkeletonCard() {
  return (
    <div className="animate-pulse rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="h-5 w-3/4 rounded bg-slate-200" />
          <div className="mt-2 h-4 w-24 rounded bg-slate-100" />
        </div>
        <div className="h-7 w-14 rounded-full bg-slate-100" />
      </div>
      <div className="mb-5 h-4 w-20 rounded bg-slate-100" />
      <div className="mb-6 h-4 w-24 rounded bg-slate-200" />
      <div className="mb-4 flex gap-2">
        <div className="h-6 w-16 rounded-full bg-slate-100" />
        <div className="h-6 w-16 rounded-full bg-slate-100" />
      </div>
      <div className="mb-6 h-4 w-full rounded bg-slate-100" />
      <div className="h-4 w-20 rounded bg-slate-100" />
    </div>
  );
}

export function DashboardRecommendationProgramCard({
  item,
  cardId,
  isApplied,
  onApplyToCalendar,
}: {
  item: ProgramCardItem;
  cardId?: string;
  isApplied: boolean;
  onApplyToCalendar: (program: ProgramCardSummary) => void;
}) {
  const { program } = item;
  const trainingPeriodLabel = formatProgramScheduleLabel(program);
  const deadlineLabel = formatProgramDeadlineDate(program.deadline);
  const cardBorderClass = getCardBorderClass(program.days_left);
  const programLink = getProgramPrimaryLink(program);
  const relevanceReasons = getProgramCardRelevanceReasons(item);
  const fitKeywords = getProgramCardFitKeywords(item);
  const relevanceBadge = getProgramCardRelevanceBadge(item);

  return (
    <article
      id={cardId}
      className={`flex min-h-[260px] flex-col rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition-shadow hover:shadow-md ${cardBorderClass}`}
    >
      <div className="mb-4 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="line-clamp-2 text-base font-semibold text-slate-950">{program.title || "제목 없음"}</h3>
          <p className="mt-2 text-sm text-slate-500">{formatProgramSourceLabel(program.source)}</p>
        </div>
        <ProgramDeadlineBadge program={program} />
      </div>

      <div className="mb-2 text-sm text-slate-600">일정: {trainingPeriodLabel}</div>
      <div className="mb-3 text-sm text-slate-600">신청 마감: {deadlineLabel}</div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {relevanceBadge ? (
          <span className="inline-flex rounded-full bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">
            {relevanceBadge}
          </span>
        ) : null}
        <span className="text-sm font-semibold text-slate-800">
          {formatProgramRelevanceText(getProgramCardScore(item))}
        </span>
      </div>

      {fitKeywords.length > 0 ? (
        <div className="mb-3 flex flex-wrap gap-2">
          {fitKeywords.map((keyword) => (
            <span
              key={`${program.id ?? program.title ?? "program"}-${keyword}`}
              className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700"
            >
              {keyword}
            </span>
          ))}
        </div>
      ) : null}

      {relevanceReasons.length > 0 ? (
        <ul className="mb-6 space-y-1.5">
          {relevanceReasons.map((reason) => (
            <li key={reason} className="line-clamp-2 text-sm leading-5 text-slate-600">
              - {reason}
            </li>
          ))}
        </ul>
      ) : null}

      <div className="mt-auto flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => onApplyToCalendar(program)}
          className={`inline-flex items-center rounded-full px-3 py-1.5 text-sm font-semibold transition ${
            isApplied
              ? "bg-emerald-50 text-emerald-700"
              : "bg-blue-600 text-white hover:bg-blue-700"
          }`}
        >
          {isApplied ? "캘린더 적용됨" : "캘린더에 적용"}
        </button>
        {programLink ? (
          <a
            href={programLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center text-sm font-medium text-blue-600 hover:text-blue-700"
          >
            자세히 보기
          </a>
        ) : (
          <span className="text-sm text-slate-400">링크 없음</span>
        )}
      </div>
    </article>
  );
}

export function DashboardBookmarkedProgramCard({ item }: { item: ProgramCardItem }) {
  const { program } = item;
  const programId = getProgramId(program);
  const detailHref = programId ? `/programs/${encodeURIComponent(programId)}` : null;
  const deadlineLabel = formatProgramDeadlineDate(program.deadline);
  const programLink = getProgramPrimaryLink(program);
  const scheduleLabel = formatProgramScheduleLabel(program);

  return (
    <article className="flex min-h-[178px] flex-col rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-amber-600">찜한 훈련</p>
          <h3 className="mt-2 line-clamp-2 text-sm font-semibold leading-5 text-slate-950">
            {program.title || "제목 없음"}
          </h3>
          <p className="mt-2 text-xs text-slate-500">
            {program.provider || formatProgramSourceLabel(program.source)}
          </p>
        </div>
        <ProgramDeadlineBadge program={program} />
      </div>
      <div className="mt-3 space-y-1 text-xs text-slate-600">
        <p>신청 마감: {deadlineLabel}</p>
        <p>일정: {scheduleLabel}</p>
      </div>
      <div className="mt-auto flex flex-wrap items-center gap-3 pt-4">
        {detailHref ? (
          <Link
            href={detailHref}
            className="inline-flex rounded-full bg-slate-950 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800"
          >
            상세 보기
          </Link>
        ) : null}
        {programLink ? (
          <a
            href={programLink}
            target="_blank"
            rel="noreferrer"
            className="inline-flex text-xs font-semibold text-blue-600 hover:text-blue-700"
          >
            원문 열기
          </a>
        ) : null}
      </div>
    </article>
  );
}
