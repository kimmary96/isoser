"use client";

import Link from "next/link";
import type { MouseEvent } from "react";
import { useState } from "react";

import type { Program } from "@/lib/types";

import { useProgramBookmarkState } from "./bookmark-state-provider";
import { deadlineLabel, deadlineTone, normalizeTextList, scorePercent } from "./program-utils";

type ProgramCardProps = {
  program: Program;
  isLoggedIn: boolean;
  initialBookmarked?: boolean;
};

export default function ProgramCard({ program, isLoggedIn, initialBookmarked = false }: ProgramCardProps) {
  const bookmarkState = useProgramBookmarkState();
  const [localBookmarked, setLocalBookmarked] = useState(initialBookmarked);
  const [pending, setPending] = useState(false);
  const programId = typeof program.id === "string" || typeof program.id === "number" ? String(program.id) : "";
  const bookmarked = programId && bookmarkState ? bookmarkState.isBookmarked(programId) : localBookmarked;
  const href = programId ? `/programs/${encodeURIComponent(programId)}` : "/programs";
  const chips = [...normalizeTextList(program.tags), ...normalizeTextList(program.skills)].slice(0, 4);
  const reasons = (program.relevance_reasons?.length ? program.relevance_reasons : program._reason ? [program._reason] : []).slice(0, 3);
  const percent = scorePercent(program);
  const badge = program.relevance_badge ?? (percent !== null && percent >= 80 ? "딱 맞아요" : percent !== null && percent >= 60 ? "추천" : percent !== null && percent >= 40 ? "조건 일치" : null);
  const deadline = deadlineLabel(program);

  async function toggleBookmark(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!isLoggedIn || !programId || pending) return;
    setPending(true);
    const next = !bookmarked;
    try {
      const response = await fetch(`/api/dashboard/bookmarks/${encodeURIComponent(programId)}`, {
        method: next ? "POST" : "DELETE",
      });
      if (response.ok) {
        if (bookmarkState) {
          bookmarkState.setBookmarked(programId, next);
        } else {
          setLocalBookmarked(next);
        }
      }
    } finally {
      setPending(false);
    }
  }

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
        ) : null}

        {chips.length > 0 ? (
          <div className="mt-5 flex flex-wrap gap-2">
            {chips.map((chip) => (
              <span key={`${programId}-${chip}`} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-600">#{chip}</span>
            ))}
          </div>
        ) : null}
      </Link>

      <button
        type="button"
        disabled={!isLoggedIn || pending}
        onClick={toggleBookmark}
        aria-label={bookmarked ? "찜 해제" : "찜하기"}
        className={`absolute right-4 top-4 inline-flex h-8 w-8 items-center justify-center rounded-full border text-sm transition ${
          bookmarked ? "border-amber-200 bg-amber-50 text-amber-500" : "border-slate-200 bg-white text-slate-400 hover:text-amber-500"
        } ${!isLoggedIn ? "cursor-not-allowed opacity-60" : ""}`}
      >
        ★
      </button>
    </article>
  );
}
