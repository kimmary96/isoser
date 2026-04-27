import type { ProgramListRow } from "@/lib/types";

export const PUBLIC_PROGRAM_LANDING_SNAPSHOT_LIMIT = 24;

export function getKstTodayDateString(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Seoul",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function dedupePrograms(programs: ProgramListRow[], limit?: number): ProgramListRow[] {
  const seenIds = new Set<string>();
  const deduped: ProgramListRow[] = [];

  for (const program of programs) {
    const id = String(program.id ?? "").trim();
    if (!id || seenIds.has(id)) {
      continue;
    }
    seenIds.add(id);
    deduped.push(program);
    if (typeof limit === "number" && deduped.length >= limit) {
      break;
    }
  }

  return deduped;
}

export function parseProgramLandingChipSnapshotItems(
  value: unknown,
  limit = PUBLIC_PROGRAM_LANDING_SNAPSHOT_LIMIT
): ProgramListRow[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const safeLimit = Math.max(1, limit);
  const parsedPrograms: ProgramListRow[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") {
      continue;
    }

    const program = item as ProgramListRow;
    const programId = String(program.id ?? "").trim();
    if (!programId) {
      continue;
    }

    parsedPrograms.push(program);
    if (parsedPrograms.length >= safeLimit) {
      break;
    }
  }

  return dedupePrograms(parsedPrograms, safeLimit);
}

export function isProgramOpenOnReferenceDate(
  program: Pick<ProgramListRow, "deadline" | "days_left" | "is_active">,
  referenceDate: string
): boolean {
  if (typeof program.days_left === "number" && Number.isFinite(program.days_left)) {
    return program.days_left >= 0;
  }

  const deadline = String(program.deadline ?? "").trim();
  if (deadline) {
    const normalizedDeadline = deadline.slice(0, 10);
    if (normalizedDeadline && normalizedDeadline < referenceDate) {
      return false;
    }
  }

  if (program.is_active === false && !deadline) {
    return false;
  }

  return true;
}

export function filterOpenProgramsByReferenceDate(
  programs: ProgramListRow[],
  referenceDate: string
): ProgramListRow[] {
  return programs.filter((program) => isProgramOpenOnReferenceDate(program, referenceDate));
}
