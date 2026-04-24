"use client";

import Link from "next/link";

import {
  getProgramCardReason,
  getProgramCardRelevanceReasons,
  toProgramCardItem,
} from "@/lib/program-card-items";
import type { ProgramCardRenderable, ProgramSurfaceContext } from "@/lib/types";

import ProgramBookmarkButton from "./program-bookmark-button";
import { deadlineLabel, deadlineTone, normalizeTextList, scorePercent } from "./program-utils";

type ProgramCardProps = {
  program: ProgramCardRenderable;
  context?: ProgramSurfaceContext | null;
  isLoggedIn: boolean;
  initialBookmarked?: boolean;
};

export default function ProgramCard({
  program,
  context = null,
  isLoggedIn,
  initialBookmarked = false,
}: ProgramCardProps) {
  const item = toProgramCardItem(program, context);
  const programId = typeof program.id === "string" || typeof program.id === "number" ? String(program.id) : "";
  const href = programId ? `/programs/${encodeURIComponent(programId)}` : "/programs";
  const chips = [...normalizeTextList(program.tags), ...normalizeTextList(program.skills)].slice(0, 4);
  const reasons = getProgramCardRelevanceReasons(item);
  const percent = scorePercent(program, context);
  const badge =
    context?.relevance_badge ??
    (percent !== null && percent >= 80
      ? "딱 맞아요"
      : percent !== null && percent >= 60
        ? "추천"
        : percent !== null && percent >= 40
          ? "조건 일치"
          : null);
  const deadline = deadlineLabel(program);
  const primaryReason = getProgramCardReason(item);

  return (
    <article className="relative h-full rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:border-slate-300 hover:shadow-md">
      <Link href={href} className="block h-full p-5">
        <div className="flex items-start justify-between gap-3 pr-9">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{program.source}</p>
            <h2 className="mt-2 line-clamp-2 text-lg font-semibold tracking-tight text-slate-950">{program.title}</h2>
          </div>
          {deadline ? <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${deadlineTone(program)}`}>{deadline}</span> : null}
        </div>

        {badge || percent !== null ? (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            {badge ? <span className="rounded-md bg-orange-50 px-2.5 py-1 text-xs font-semibold text-orange-700">{badge}</span> : null}
            {percent !== null ? <span className="text-xs font-semibold text-slate-500">관련도 {percent}%</span> : null}
          </div>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2 text-sm text-slate-600">
          {program.category ? <span className="rounded-full bg-slate-50 px-3 py-1">{program.category}</span> : null}
          {program.provider ? <span className="rounded-full bg-slate-50 px-3 py-1">{program.provider}</span> : null}
          {program.location ? <span className="rounded-full bg-slate-50 px-3 py-1">{program.location}</span> : null}
        </div>

        {program.summary || program.description ? (
          <p className="mt-4 line-clamp-3 text-sm leading-6 text-slate-600">{program.summary || program.description}</p>
        ) : null}

        {reasons.length > 0 ? (
          <ul className="mt-4 space-y-1.5">
            {reasons.map((reason) => (
              <li key={reason} className="text-sm leading-5 text-slate-700">- {reason}</li>
            ))}
          </ul>
        ) : primaryReason ? (
          <p className="mt-4 text-sm leading-5 text-slate-700">- {primaryReason}</p>
        ) : null}

        {chips.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {chips.map((chip) => (
              <span key={`${programId}-${chip}`} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">#{chip}</span>
            ))}
          </div>
        ) : null}
      </Link>

      {programId ? (
        <ProgramBookmarkButton
          programId={programId}
          isLoggedIn={isLoggedIn}
          initialBookmarked={initialBookmarked}
          className="absolute right-4 top-4"
        />
      ) : null}
    </article>
  );
}
