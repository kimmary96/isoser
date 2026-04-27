import Link from "next/link";

import { ProgramDeadlineBadge } from "@/components/programs/program-deadline-badge";
import { formatProgramScheduleLabel } from "@/lib/program-display";
import { buildUrgentProgramChips } from "@/lib/programs-page-layout";
import type { ProgramListRow } from "@/lib/types";

export function UrgentProgramCompactCard({ program }: { program: ProgramListRow }) {
  const programId = String(program.id ?? "");
  const href = programId ? `/programs/${encodeURIComponent(programId)}` : "/programs";
  const chips = buildUrgentProgramChips(program);
  const summary = program.summary || program.description;
  const scheduleLabel = formatProgramScheduleLabel(program);
  const schedule = scheduleLabel === "일정 확인 필요" ? null : scheduleLabel;

  return (
    <Link
      href={href}
      className="block h-full rounded-[18px] border border-white/70 bg-white/90 p-4 shadow-[0_16px_42px_rgba(10,19,37,0.08)] backdrop-blur-sm transition hover:-translate-y-0.5 hover:bg-white hover:shadow-[0_24px_58px_rgba(10,19,37,0.12)]"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-bold uppercase tracking-[0.16em] text-slate-500">
            {program.source || program.provider || "-"}
          </p>
          <h3 className="mt-1.5 line-clamp-2 text-base font-black leading-6 text-slate-950">{program.title}</h3>
          {schedule ? <p className="mt-2 line-clamp-1 text-xs font-semibold text-slate-500">{schedule}</p> : null}
        </div>
        <ProgramDeadlineBadge program={program} />
      </div>

      {chips.length ? (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {chips.map((chip) => (
            <span key={`${programId}-${chip}`} className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-extrabold text-slate-600">
              {chip}
            </span>
          ))}
        </div>
      ) : null}

      {summary ? <p className="mt-3 line-clamp-2 text-sm leading-5 text-slate-600">{summary}</p> : null}
    </Link>
  );
}
