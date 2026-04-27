"use client";

import Link from "next/link";

import { ModalShell } from "@/app/dashboard/_components/modal-shell";
import {
  formatProgramDateRangeLabel,
  formatProgramDeadlineDate,
  formatProgramSourceLabel,
  getProgramId,
  getProgramPrimaryLink,
} from "@/lib/program-display";
import type { ProgramCardItem, ProgramDetail } from "@/lib/types";

import { DASHBOARD_COPY } from "../dashboard-copy";

type ProgramPreviewModalProps = {
  open: boolean;
  item: ProgramCardItem | null;
  detail: ProgramDetail | null;
  loading: boolean;
  error: string | null;
  onClose: () => void;
};

export function ProgramPreviewModal({
  open,
  item,
  detail,
  loading,
  error,
  onClose,
}: ProgramPreviewModalProps) {
  const program = item?.program ?? null;
  const programId = getProgramId(program);
  const detailHref = programId ? `/programs/${encodeURIComponent(programId)}` : null;
  const externalLink = getProgramPrimaryLink(detail ?? program);
  const providerLabel =
    detail?.provider ||
    program?.provider ||
    formatProgramSourceLabel(detail?.source ?? program?.source);
  const categoryLabel =
    detail?.display_categories?.filter(Boolean).join(" · ") ||
    detail?.category ||
    program?.category ||
    DASHBOARD_COPY.programs.fallbackCategory;
  const deadlineLabel = formatProgramDeadlineDate(detail?.deadline ?? program?.deadline);
  const scheduleLabel =
    formatProgramDateRangeLabel(detail?.program_start_date, detail?.program_end_date, {
      unknownLabel: null,
    }) ??
    formatProgramDateRangeLabel(detail?.application_start_date, detail?.application_end_date, {
      unknownLabel: "일정 확인 필요",
    }) ??
    "일정 확인 필요";
  const description =
    detail?.description?.trim() ||
    program?.summary?.trim() ||
    program?.description?.trim() ||
    "간단 미리보기를 아직 준비하지 못했습니다.";

  return (
    <ModalShell
      open={open}
      onClose={onClose}
      eyebrow="과정 미리보기"
      title={detail?.title ?? program?.title ?? "과정 정보"}
      subtitle={providerLabel}
      maxWidthClassName="max-w-2xl"
      footer={
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
            {detailHref ? (
              <Link
                href={detailHref}
                className="inline-flex rounded-full border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:bg-slate-50"
              >
                상세 페이지 보기
              </Link>
            ) : null}
            {externalLink ? (
              <a
                href={externalLink}
                target="_blank"
                rel="noreferrer"
                className="inline-flex rounded-full bg-[#4361ee] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#3451d1]"
              >
                신청 링크 열기
              </a>
            ) : null}
          </div>
        </div>
      }
    >
      {loading ? (
        <div className="py-12 text-center text-sm text-slate-500">과정 상세를 불러오는 중입니다.</div>
      ) : error ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
              {categoryLabel}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
              마감 {deadlineLabel}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
              일정 {scheduleLabel}
            </span>
            {detail?.teaching_method ? (
              <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-medium text-slate-700">
                {detail.teaching_method}
              </span>
            ) : null}
          </div>

          <div className="rounded-2xl bg-slate-50 px-4 py-4">
            <p className="whitespace-pre-line text-sm leading-7 text-slate-700">{description}</p>
          </div>

          {detail?.recommended_for?.length ? (
            <div>
              <h3 className="text-sm font-semibold text-slate-900">이런 분께 맞아요</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {detail.recommended_for.slice(0, 6).map((value) => (
                  <span
                    key={value}
                    className="rounded-full bg-blue-50 px-3 py-1 text-sm font-medium text-blue-700"
                  >
                    {value}
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </ModalShell>
  );
}
