import type { ResumeBuilderProfile } from "@/lib/types";

export const RESUME_PROFILE_COLUMNS =
  "name, bio, avatar_url, email, phone, self_intro, skills, awards, certifications, languages";

export const RESUME_PROFILE_BASE_COLUMNS =
  "name, avatar_url, email, phone, self_intro, skills";

export type ResumeProfileHighlightKey = "awards" | "certifications" | "languages";

export type ResumeProfileHighlightSection = {
  key: ResumeProfileHighlightKey;
  title: string;
  items: string[];
};

const PROFILE_HIGHLIGHT_TITLES: Record<ResumeProfileHighlightKey, string> = {
  awards: "수상",
  certifications: "자격증",
  languages: "어학",
};

function normalizeStringList(value: unknown): string[] {
  const values = Array.isArray(value)
    ? value
    : typeof value === "string"
      ? value.split(/\r?\n|,/)
      : [];

  const normalized: string[] = [];
  for (const item of values) {
    if (typeof item !== "string") continue;
    const text = item.replace(/\s+/g, " ").trim();
    if (text && !normalized.includes(text)) normalized.push(text);
  }
  return normalized;
}

function normalizeText(value: unknown): string {
  return typeof value === "string" ? value : "";
}

export function normalizeResumeBuilderProfile(value: unknown): ResumeBuilderProfile | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const row = value as Record<string, unknown>;

  return {
    name: normalizeText(row.name),
    bio: normalizeText(row.bio),
    avatar_url: typeof row.avatar_url === "string" ? row.avatar_url : null,
    email: normalizeText(row.email),
    phone: normalizeText(row.phone),
    self_intro: normalizeText(row.self_intro),
    skills: normalizeStringList(row.skills),
    awards: normalizeStringList(row.awards),
    certifications: normalizeStringList(row.certifications),
    languages: normalizeStringList(row.languages),
  };
}

export function getResumeProfileHighlightSections(
  profile: Pick<ResumeBuilderProfile, ResumeProfileHighlightKey> | null | undefined
): ResumeProfileHighlightSection[] {
  if (!profile) return [];

  return (Object.keys(PROFILE_HIGHLIGHT_TITLES) as ResumeProfileHighlightKey[])
    .map((key) => ({
      key,
      title: PROFILE_HIGHLIGHT_TITLES[key],
      items: normalizeStringList(profile[key]),
    }))
    .filter((section) => section.items.length > 0);
}

export function isMissingResumeProfileColumnError(error: {
  code?: string;
  message?: string;
} | null | undefined): boolean {
  if (!error) return false;
  const message = error.message?.toLowerCase() ?? "";
  return (
    error.code === "42703" ||
    error.code === "PGRST204" ||
    message.includes("bio") ||
    message.includes("awards") ||
    message.includes("certifications") ||
    message.includes("languages")
  );
}
