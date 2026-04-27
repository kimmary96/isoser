import { getActivityMetaItems, getActivityResumeLines } from "@/lib/activity-display";
import type { ResumeActivityLineOverrides } from "@/lib/resume-line-overrides";
import type { Activity } from "@/lib/types";

export function getResumeActivityBodyLines(
  activity: Activity,
  activityLineOverrides: ResumeActivityLineOverrides
): string[] {
  const overrideLines =
    activityLineOverrides[activity.id]?.map((line) => line.trim()).filter(Boolean) ?? [];

  if (overrideLines.length > 0) return overrideLines;

  const metaItems = getActivityMetaItems(activity);
  return getActivityResumeLines(activity).slice(metaItems.length > 0 ? 1 : 0);
}
