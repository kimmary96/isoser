import { unwrapProgramListRows } from "../program-display";
import type { ProgramCardSummary, ProgramListPageResponse } from "../types";

export function extractBackendFallbackPrograms(
  page: Pick<ProgramListPageResponse, "items">
): ProgramCardSummary[] {
  return unwrapProgramListRows(page.items ?? []);
}
