import Link from "next/link";

import { ProgramProviderBrand } from "@/components/programs/program-provider-brand";
import type { ProgramListRow } from "@/lib/types";

import {
  formatProgramParticipationTime,
  getSelectionKeywordTone,
} from "./page-helpers";
import ProgramBookmarkButton from "./program-bookmark-button";
import {
  deadlineTone,
} from "./program-utils";
import {
  extractSelectionKeywords,
  formatCost,
  formatMethodAndRegion,
  formatRecruitingStatus,
  formatSchedule,
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
            <th scope="col" className="w-[7%] px-4 py-3">비용 정보</th>
            <th scope="col" className="w-[10%] px-4 py-3">온·오프라인</th>
            <th scope="col" className="w-[9%] px-4 py-3">일정</th>
            <th scope="col" className="w-[10%] px-4 py-3">참여 시간</th>
            <th scope="col" className="w-[18%] px-4 py-3">선발절차·키워드</th>
            <th scope="col" className="w-[7%] px-4 py-3">운영기관</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 bg-white">
          {programs.map((program) => {
            const programId = String(program.id ?? "");
            const href = programId ? `/programs/${encodeURIComponent(programId)}` : "/programs";
            const categories = getDisplayCategories(program);
            const participation = formatProgramParticipationTime(program);
            const methodAndRegion = formatMethodAndRegion(program);
            const selectionKeywords = extractSelectionKeywords(program);
            const supportBadge = getSupportBadge(program);
            const selectionProcessLabel =
              program.selection_process_label && program.selection_process_label !== "선발 절차 없음"
                ? program.selection_process_label
                : null;
            const rowClassName = program.is_ad
              ? "bg-amber-50/70 hover:bg-amber-50"
              : "hover:bg-slate-50";

            return (
              <tr key={programId || `${program.source}-${program.title}`} className={`align-top transition ${rowClassName}`}>
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
                  <Link href={href} className="mt-1 block text-base font-semibold leading-6 text-slate-950 hover:text-orange-700">
                    {program.title}
                  </Link>
                </td>
                <td className="px-4 py-4">
                  <div className="flex flex-wrap gap-1.5">
                    {categories.map((category, index) => (
                      <span
                        key={category}
                        className={`rounded-md px-2 py-1 text-xs font-medium ${
                          index === 0 ? "bg-slate-100 text-slate-700" : "bg-slate-50 text-slate-600"
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
                        <span className="inline-flex rounded-md bg-slate-100 px-2 py-1 text-xs font-semibold text-slate-700">
                          {methodAndRegion.method}
                        </span>
                      ) : null}
                      {methodAndRegion.region ? <p className="text-xs leading-5 text-slate-600">{methodAndRegion.region}</p> : null}
                    </div>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-4 py-4 text-slate-600">{formatSchedule(program)}</td>
                <td className="px-4 py-4 text-slate-600">
                  {participation.label || participation.detail ? (
                    <div className="flex flex-wrap gap-1.5">
                      {participation.label ? (
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700">
                          {participation.label}
                        </span>
                      ) : null}
                      {participation.detail ? (
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                          {participation.detail}
                        </span>
                      ) : null}
                    </div>
                  ) : (
                    "-"
                  )}
                </td>
                <td className="px-4 py-4">
                  {selectionProcessLabel ? (
                    <div className={selectionKeywords.length ? "mb-2" : ""}>
                      <span className="inline-flex rounded-full bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                        {selectionProcessLabel}
                      </span>
                    </div>
                  ) : null}
                  {selectionKeywords.length ? (
                    <ProgramKeywordList keywords={selectionKeywords} />
                  ) : selectionProcessLabel ? null : (
                    <span className="text-slate-400">-</span>
                  )}
                </td>
                <td className="px-4 py-4 text-slate-600">
                  <ProgramProviderBrand program={program} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
