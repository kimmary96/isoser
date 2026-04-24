import Link from "next/link";

import { buildUrgentProgramChips } from "@/lib/programs-page-layout";
import type { ProgramListRow } from "@/lib/types";

import { deadlineLabel, deadlineTone } from "./program-utils";

export function UrgentProgramCompactCard({ program }: { program: ProgramListRow }) {
  const programId = String(program.id ?? "");
  const href = programId ? `/programs/${encodeURIComponent(programId)}` : "/programs";
  const chips = buildUrgentProgramChips(program);
  const summary = program.summary || program.description;
  const deadline = deadlineLabel(program);

  return (
    <Link
      href={href}
      className="block h-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-slate-300 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-semibold uppercase tracking-[0.16em] text-slate-400">
            {program.source || program.provider || "-"}
          </p>
          <h3 className="mt-1.5 line-clamp-2 text-base font-semibold leading-6 text-slate-950">{program.title}</h3>
        </div>
        {deadline ? (
          <span className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold ${deadlineTone(program)}`}>
            {deadline}
          </span>
        ) : null}
      </div>

      {chips.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <span key={`${programId}-${chip}`} className="rounded-full bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-600">
              {chip}
            </span>
          ))}
        </div>
      ) : null}

      {summary ? <p className="mt-3 line-clamp-2 text-sm leading-5 text-slate-600">{summary}</p> : null}
    </Link>
  );
}
