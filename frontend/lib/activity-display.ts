import type { Activity } from "@/lib/types";

function normalizeText(value: string | null | undefined): string {
  return (value ?? "").trim();
}

export function getActivityIntroLines(activity: Activity, maxContributions = 2): string[] {
  const description = normalizeText(activity.description);
  const contributions = Array.isArray(activity.contributions)
    ? activity.contributions.map((item) => item.trim()).filter(Boolean)
    : [];

  if (description) {
    return [description, ...contributions.slice(0, maxContributions)];
  }

  return contributions.slice(0, 3);
}

export function getActivityPreviewText(activity: Activity): string {
  return getActivityIntroLines(activity).join(" ");
}

export function getActivityMetaItems(activity: Activity): string[] {
  const items = [
    normalizeText(activity.organization),
    normalizeText(activity.my_role) || normalizeText(activity.role),
    activity.team_size ? `${activity.team_size}명` : "",
    normalizeText(activity.team_composition),
  ];

  return items.filter(Boolean);
}

export function getActivityResumeLines(activity: Activity): string[] {
  const metaItems = getActivityMetaItems(activity);
  const introLines = getActivityIntroLines(activity, 3);

  return [
    metaItems.length > 0 ? metaItems.join(" · ") : "",
    ...introLines,
  ].filter(Boolean);
}
