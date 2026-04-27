export type PublicProgramListScope = "default" | "all" | "archive";

type CountActiveProgramFilterGroupsOptions = {
  categoryId?: string | null;
  regionDetail?: string | null;
  regions?: readonly string[];
  teachingMethods?: readonly string[];
  costTypes?: readonly string[];
  participationTimes?: readonly string[];
  sources?: readonly string[];
  targets?: readonly string[];
};

export function countActiveProgramFilterGroups(options: CountActiveProgramFilterGroupsOptions): number {
  let count = 0;

  if (options.categoryId && options.categoryId !== "all") {
    count += 1;
  }

  if ((options.regionDetail ?? "").trim() || (options.regions?.length ?? 0) > 0) {
    count += 1;
  }

  if ((options.teachingMethods?.length ?? 0) > 0) {
    count += 1;
  }

  if ((options.costTypes?.length ?? 0) > 0) {
    count += 1;
  }

  if ((options.participationTimes?.length ?? 0) > 0) {
    count += 1;
  }

  if ((options.sources?.length ?? 0) > 0) {
    count += 1;
  }

  if ((options.targets?.length ?? 0) > 0) {
    count += 1;
  }

  return count;
}

export function resolvePublicProgramListScope(options: {
  keyword?: string | null;
  includeClosedRecent?: boolean;
  activeFilterGroupCount?: number;
}): PublicProgramListScope {
  const keyword = typeof options.keyword === "string" ? options.keyword.trim() : "";
  if (options.includeClosedRecent) {
    return "archive";
  }
  if (keyword || (options.activeFilterGroupCount ?? 0) >= 2) {
    return "all";
  }
  return "default";
}
