export type ResumeActivityLineOverrides = Record<string, string[]>;

const MAX_OVERRIDE_ACTIVITIES = 100;
export const MAX_RESUME_OVERRIDE_LINES_PER_ACTIVITY = 6;
export const MAX_RESUME_OVERRIDE_LINE_LENGTH = 800;

export function normalizeResumeLineText(text: string): string {
  return text
    .trim()
    .replace(/^[\s\-*•]+/, "")
    .replace(/\s+/g, " ");
}

export function normalizeResumeActivityLineOverrides(
  value: unknown
): ResumeActivityLineOverrides {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }

  const overrides: ResumeActivityLineOverrides = {};
  const entries = Object.entries(value as Record<string, unknown>).slice(0, MAX_OVERRIDE_ACTIVITIES);

  for (const [rawActivityId, rawLines] of entries) {
    const activityId = rawActivityId.trim();
    if (!activityId) continue;

    const lines = Array.isArray(rawLines)
      ? rawLines
      : typeof rawLines === "string"
        ? [rawLines]
        : [];

    const normalizedLines = Array.from(
      new Set(
        lines
          .map((line) =>
            typeof line === "string"
              ? normalizeResumeLineText(line).slice(0, MAX_RESUME_OVERRIDE_LINE_LENGTH)
              : ""
          )
          .filter(Boolean)
      )
    ).slice(0, MAX_RESUME_OVERRIDE_LINES_PER_ACTIVITY);

    if (normalizedLines.length > 0) {
      overrides[activityId] = normalizedLines;
    }
  }

  return overrides;
}

export function hasResumeActivityLineOverrides(overrides: ResumeActivityLineOverrides): boolean {
  return Object.values(overrides).some((lines) =>
    lines.some((line) => normalizeResumeLineText(line).length > 0)
  );
}
