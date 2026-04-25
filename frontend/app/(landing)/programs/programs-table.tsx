import Link from "next/link";

import type { ProgramListRow } from "@/lib/types";

import {
  formatProgramParticipationTime,
  getSelectionKeywordTone,
} from "./page-helpers";
import ProgramBookmarkButton from "./program-bookmark-button";
import {
  deadlineTone,
  normalizeTextList,
  scorePercent,
} from "./program-utils";
import {
  extractSelectionKeywords,
  formatCost,
  formatDateRange,
  formatMethodAndRegion,
  formatRecruitingStatus,
  formatShortDate,
  getDisplayCategories,
  getSupportBadge,
} from "./programs-table-helpers";

function ProgramKeywordList({ keywords }: { keywords: string[] }) {
  if (keywords.length === 0) return <span className="text-slate-400">-</span>;

  return (
    <div className="flex max-w-md flex-wrap gap-1.5">
      {keywords.slice(0, 8).map((keyword) => (
        <span key={keyword} className={`rounded-md px-2 py-1 text-xs font-medium ${getSelectionKeywordTone(keyword)}`}>
          {keyword}
        </span>
      ))}
      {keywords.length > 8 ? (
        <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-500">+{keywords.length - 8}</span>
      ) : null}
    </div>
  );
}

export function ProgramsTable({
  programs,
  isLoggedIn,
  bookmarkedProgramIds,
}: {
  programs: ProgramListRow[];
  isLoggedIn: boolean;
  bookmarkedProgramIds: string[];
}) {
  return (
    <div className="mt-6 border-y border-slate-200">
      <table className="w-full table-fixed border-collapse text-left text-sm">
        <thead className="bg-slate-50 text-xs font-semibold text-slate-500">
          <tr>
            <th scope="col" className="w-12 px-4 py-3" aria-label="찜" />
            <th scope="col" className="w-[20%] px-4 py-3">교육기관명 / 프로그램명</th>
            <th scope="col" className="w-[11%] px-4 py-3">프로그램 과정</th>
            <th scope="col" className="w-[8%] px-4 py-3">모집상태</th>
            <th scope="col" className="w-[7%] px-4 py-3">본인부담금</th>
            <th scope="col" className="w-[10%] px-4 py-3">온·오프라인</th>
            <th scope="col" className="w-[9%] px-4 py-3">학습기간</th>
            <th scope="col" className="w-[10%] px-4 py-3">참여 시간</th>
            <th scope="col" className="w-[18%] px-4 py-3">선발절차·키워드</th>
            <th scope="col" className="w-[7%] px-4 py-3">운영기관</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {programs.map((program) => {
            const programId = String(program.id ?? "");
            const href = programId ? `/programs/${encodeURIComponent(programId)}` : "/programs";
            const percent = scorePercent(program);
            const categories = getDisplayCategories(program);
            const participation = formatProgramParticipationTime(program);
            const methodAndRegion = formatMethodAndRegion(program);
            const selectionKeywords = extractSelectionKeywords(program);
            const supportBadge = getSupportBadge(program);

            return (
              <tr key={programId || `${program.source}-${program.title}`} className="align-top transition hover:bg-slate-50">
                <td className="px-4 py-4">
                  {programId ? (
                    <ProgramBookmarkButton
                      programId={programId}
                      isLoggedIn={isLoggedIn}
                      initialBookmarked={bookmarkedProgramIds.includes(programId)}
                    />
                  ) : null}
                </td>
                <td className="px-4 py-4">
                  <p className="text-xs font-medium text-slate-500">{program.provider || program.source || "-"}</p>
                  <Link href={href} className="mt-1 block text-base font-semibold leading-6 text-slate-950 hover:text-violet-700">
                    {program.title}
                  </Link>
                  {normalizeTextList(program.recommendation_reasons).length ? (
                    <div className="mt-2 flex flex-wrap gap-1.5">
                      {normalizeTextList(program.recommendation_reasons).slice(0, 3).map((reason) => (
                        <span key={reason} className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-semibold text-emerald-700">
                          {reason}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {percent !== null ? <p className="mt-1 text-xs font-semibold text-violet-600">관련도 {percent}%</p> : null}
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map((category, index) => (
                      <span
                        key={category}
                        className={`rounded-md px-2 py-1 text-xs font-medium ${
                          index === 0 ? "bg-violet-50 text-violet-700" : "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {category}
                      </span>
                    ))}
                    {categories.length === 0 ? <span className="text-slate-400">-</span> : null}
                  </div>
                </td>
                <td className="px-4 py-4">
                  <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${deadlineTone(program)}`}>
                    {formatRecruitingStatus(program)}
                  </span>
                  <p className="mt-1 text-xs text-slate-500">{formatShortDate(program.deadline)}</p>
                </td>
                <td className="px-4 py-4 font-medium text-slate-700">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span>{formatCost(program)}</span>
                    {supportBadge ? (
                      <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
                        {supportBadge}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-4 text-slate-600">
                  {methodAndRegion.method || methodAndRegion.region ? (
                    <div className="space-y-1">
                      {methodAndRegion.method ? (
                        <span className="inline-flex rounded-md bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-700">
                          {methodAndRegion.method}
                        </span>
                      ) : null}
                      {methodAndRegion.region ? <p className="text-xs leading-5 text-slate-600">{methodAndRegion.region}</p> : null}
                    </div>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-4 py-4 text-slate-600">{formatDateRange(program.start_date, program.end_date)}</td>
                <td className="px-4 py-4 text-slate-600">
                  {participation.label || participation.detail ? (
                    <div className="space-y-1">
                      {participation.label ? (
                        <span className="inline-flex rounded-md bg-teal-50 px-2 py-1 text-xs font-semibold text-teal-700">
                          {participation.label}
                        </span>
                      ) : null}
                      {participation.detail ? <p className="text-xs leading-5 text-slate-600">{participation.detail}</p> : null}
                    </div>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-4 py-4">
                  {program.selection_process_label ? (
                    <p
                      className={`text-xs font-semibold ${
                        program.selection_process_label === "선발 절차 없음" ? "text-slate-500" : "text-blue-700"
                      } ${selectionKeywords.length ? "mb-2" : ""}`}
                    >
                      {program.selection_process_label}
                    </p>
                  ) : null}
                  {selectionKeywords.length ? (
                    <ProgramKeywordList keywords={selectionKeywords} />
                  ) : program.selection_process_label ? null : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
                <td className="px-4 py-4 text-slate-600">{program.source || "-"}</td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
