import { unwrapProgramListRows } from "../program-display";
import type { ProgramCardRenderable, ProgramListPageResponse } from "../types";

export function extractBackendFallbackPrograms(
  page: Pick<ProgramListPageResponse, "items">
): ProgramCardRenderable[] {
  return unwrapProgramListRows(page.items ?? []);
}
