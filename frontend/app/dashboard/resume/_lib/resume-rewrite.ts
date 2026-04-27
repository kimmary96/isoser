import type { Activity } from "@/lib/types";
import {
  MAX_RESUME_OVERRIDE_LINE_LENGTH,
  MAX_RESUME_OVERRIDE_LINES_PER_ACTIVITY,
  normalizeResumeLineText,
  type ResumeActivityLineOverrides,
} from "@/lib/resume-line-overrides";

export type ResumeRewriteSectionType = Activity["type"] | "요약";
export type AppliedResumeRewriteLines = ResumeActivityLineOverrides;

export function appendJobPostingText(currentText: string, extractedText: string): string {
  const current = currentText.trim();
  const extracted = extractedText.trim();

  if (!extracted) return currentText;
  if (!current) return extracted;
  return `${current}\n\n---\n\n${extracted}`;
}

export function resolveResumeRewriteSectionType(
  activities: Pick<Activity, "type">[]
): ResumeRewriteSectionType {
  const uniqueTypes = Array.from(new Set(activities.map((activity) => activity.type).filter(Boolean)));
  if (uniqueTypes.length === 1) return uniqueTypes[0];
  return "요약";
}

export function mapResumeRewriteActivityTitles(
  activities: Pick<Activity, "id" | "title">[]
): Record<string, string> {
  const titles: Record<string, string> = {};
  for (const activity of activities) {
    if (activity.id && activity.title) {
      titles[activity.id] = activity.title;
    }
  }
  return titles;
}

export function canRequestResumeRewrite({
  selectedCount,
  targetJob,
  jobPostingText,
  loading,
}: {
  selectedCount: number;
  targetJob: string;
  jobPostingText: string;
  loading: boolean;
}): boolean {
  return (
    selectedCount > 0 &&
    targetJob.trim().length > 0 &&
    jobPostingText.trim().length >= 50 &&
    !loading
  );
}

export function normalizeResumeRewriteText(text: string): string {
  return normalizeResumeLineText(text);
}

export function normalizeResumeRewriteDraftText(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/^\s*[-*•]\s*/, "")
    .slice(0, MAX_RESUME_OVERRIDE_LINE_LENGTH);
}

export function applyResumeRewriteLine(
  current: AppliedResumeRewriteLines,
  activityId: string,
  text: string
): AppliedResumeRewriteLines {
  const normalizedText = normalizeResumeRewriteText(text);
  if (!activityId || !normalizedText) return current;

  return {
    ...current,
    [activityId]: [normalizedText],
  };
}

export function updateResumeRewriteLine(
  current: AppliedResumeRewriteLines,
  activityId: string,
  lineIndex: number,
  text: string
): AppliedResumeRewriteLines {
  const currentLines = current[activityId];
  if (!activityId || !currentLines || lineIndex < 0 || lineIndex >= currentLines.length) {
    return current;
  }

  const nextLines = [...currentLines];
  nextLines[lineIndex] = normalizeResumeRewriteDraftText(text);
  return {
    ...current,
    [activityId]: nextLines,
  };
}

export function addResumeRewriteLine(
  current: AppliedResumeRewriteLines,
  activityId: string
): AppliedResumeRewriteLines {
  if (!activityId) return current;

  const currentLines = current[activityId] ?? [];
  if (currentLines.length >= MAX_RESUME_OVERRIDE_LINES_PER_ACTIVITY) return current;

  return {
    ...current,
    [activityId]: [...currentLines, ""],
  };
}

export function removeResumeRewriteLine(
  current: AppliedResumeRewriteLines,
  activityId: string,
  lineIndex: number
): AppliedResumeRewriteLines {
  const currentLines = current[activityId];
  if (!activityId || !currentLines || lineIndex < 0 || lineIndex >= currentLines.length) {
    return current;
  }

  const nextLines = currentLines.filter((_, index) => index !== lineIndex);
  if (nextLines.length === 0) {
    return clearResumeRewriteLine(current, activityId);
  }

  return {
    ...current,
    [activityId]: nextLines,
  };
}

export function clearResumeRewriteLine(
  current: AppliedResumeRewriteLines,
  activityId: string
): AppliedResumeRewriteLines {
  if (!activityId || !current[activityId]) return current;

  const next = { ...current };
  delete next[activityId];
  return next;
}

export function isResumeRewriteSuggestionApplied(
  appliedLines: AppliedResumeRewriteLines,
  activityId: string,
  text: string
): boolean {
  const normalizedText = normalizeResumeRewriteText(text);
  return Boolean(normalizedText && appliedLines[activityId]?.[0] === normalizedText);
}
