import type { Activity } from "@/lib/types";

export type EditableSection =
  | "career"
  | "education_history"
  | "awards"
  | "certifications"
  | "languages"
  | "skills"
  | "self_intro";

export type CareerEntry = {
  company: string;
  position: string;
  start: string;
  end: string;
};

export type CareerCard = {
  company: string;
  position: string;
  period: string;
  activities: Activity[];
};

export function toArray(value: string[] | null | undefined): string[] {
  return Array.isArray(value) ? value : [];
}

function normalizeText(value: string): string {
  return value.replace(/\s+/g, "").toLowerCase();
}

export function splitPeriod(periodText: string): [string, string] {
  const normalized = periodText.replace(/–|—|-/g, "~");
  const parts = normalized.split("~").map((part) => part.trim()).filter(Boolean);
  if (parts.length === 0) return ["", ""];
  if (parts.length === 1) return [parts[0], ""];
  return [parts[0], parts[1]];
}

function toCareerPeriodParts(periodText: string): Pick<CareerEntry, "start" | "end"> {
  const [start, end] = splitPeriod(periodText);
  return { start, end };
}

export function formatCareerPeriod(entry: CareerEntry): string {
  const start = entry.start.trim();
  const end = entry.end.trim();
  if (!start && !end) return "";
  if (!end) return start;
  return `${start} ~ ${end}`;
}

export function parseCareerLine(line: string): CareerEntry {
  const trimmed = line.trim();
  if (!trimmed) {
    return { company: "", position: "", start: "", end: "" };
  }

  const pipeParts = trimmed.split("|").map((part) => part.trim()).filter(Boolean);
  if (pipeParts.length >= 4) {
    return {
      company: pipeParts[0],
      position: pipeParts[1],
      start: pipeParts[2],
      end: pipeParts[3],
    };
  }

  if (pipeParts.length >= 3) {
    const [start, end] = splitPeriod(pipeParts.slice(2).join(" | "));
    return {
      company: pipeParts[0],
      position: pipeParts[1],
      start,
      end,
    };
  }

  const slashParts = trimmed.split("/").map((part) => part.trim()).filter(Boolean);
  if (slashParts.length >= 3) {
    const [start, end] = splitPeriod(slashParts.slice(2).join(" / "));
    return {
      company: slashParts[0],
      position: slashParts[1],
      start,
      end,
    };
  }

  return {
    company: trimmed,
    position: "",
    start: "",
    end: "",
  };
}

export function isStructuredCareerLine(line: string): boolean {
  const text = line.trim();
  if (!text) return false;
  const hasSeparator = text.includes("|") || text.includes("/");
  const hasDateToken = /\d{4}(?:[./-]\d{1,2})?/.test(text) || /현재|present|now/i.test(text);
  return hasSeparator || hasDateToken;
}

export function serializeCareerEntry(entry: CareerEntry): string {
  const company = entry.company.trim();
  const position = entry.position.trim();
  const start = entry.start.trim();
  const end = entry.end.trim();

  if (!company && !position && !start && !end) {
    return "";
  }

  if (!position && !start && !end) {
    return company;
  }

  return [company || "-", position || "-", start || "-", end || "-"].join(" | ");
}

export function parsePeriodRange(periodText: string): { start: number; end: number } | null {
  const normalized = periodText.replace(/~|–|—|-/g, "~");
  const segments = normalized.split("~").map((segment) => segment.trim()).filter(Boolean);

  const parsePoint = (value: string): number | null => {
    if (!value) return null;
    if (/현재|present|now/i.test(value)) return Number.MAX_SAFE_INTEGER;

    const match = value.match(/(\d{4})(?:[.\/-]?(\d{1,2}))?/);
    if (!match) return null;
    const year = Number(match[1]);
    const month = match[2] ? Number(match[2]) : 1;
    if (!Number.isFinite(year) || !Number.isFinite(month)) return null;
    return year * 100 + Math.max(1, Math.min(month, 12));
  };

  if (segments.length === 1) {
    const point = parsePoint(segments[0]);
    return point ? { start: point, end: point } : null;
  }

  const start = parsePoint(segments[0]);
  const end = parsePoint(segments[1]);
  if (!start || !end) return null;
  return { start, end };
}

export function getActivitySortValue(activity: Activity): number {
  const period = parsePeriodRange(activity.period || "");
  if (period) return period.end;

  const createdAt = Date.parse(activity.created_at);
  if (Number.isFinite(createdAt)) return createdAt;

  return 0;
}

function isPeriodOverlapped(a: string, b: string): boolean {
  const rangeA = parsePeriodRange(a);
  const rangeB = parsePeriodRange(b);
  if (!rangeA || !rangeB) return false;
  return rangeA.start <= rangeB.end && rangeB.start <= rangeA.end;
}

function getLinkedActivities(career: CareerEntry, activities: Activity[]): Activity[] {
  const companyKey = normalizeText(career.company);
  const periodText = formatCareerPeriod(career);

  const linked = activities.filter((activity) => {
    if (!companyKey && !periodText) return false;

    const textBlob = normalizeText(`${activity.title} ${activity.description || ""}`);
    const companyMatched = companyKey.length > 1 && textBlob.includes(companyKey);
    const periodMatched = Boolean(periodText && activity.period && isPeriodOverlapped(periodText, activity.period));

    return companyMatched || periodMatched;
  });

  return [...linked].sort((a, b) => getActivitySortValue(b) - getActivitySortValue(a));
}

export function getCareerItemsFromActivities(activities: Activity[]): string[] {
  const careerActivities = activities
    .filter((activity) => activity.type === "회사경력")
    .sort((a, b) => getActivitySortValue(b) - getActivitySortValue(a));

  const unique = new Set<string>();
  careerActivities.forEach((activity) => {
    const line = serializeCareerEntry({
      company: activity.title || "",
      position: activity.role || "",
      ...toCareerPeriodParts(activity.period || ""),
    });
    if (line) unique.add(line);
  });

  return [...unique];
}

export function buildCareerCards(careerItems: string[], activities: Activity[]): CareerCard[] {
  const parsed = careerItems
    .filter(isStructuredCareerLine)
    .map(parseCareerLine)
    .filter((item) => item.company || item.position || item.start || item.end);

  if (parsed.length === 0) return [];

  const grouped = new Map<string, CareerEntry[]>();
  parsed.forEach((entry) => {
    const key = normalizeText(entry.company || "미분류");
    const list = grouped.get(key) || [];
    list.push(entry);
    grouped.set(key, list);
  });

  const manualCards: CareerCard[] = [];

  grouped.forEach((entries) => {
    const sortedEntries = [...entries].sort((a, b) => {
      const endA = parsePeriodRange(formatCareerPeriod(a))?.end || 0;
      const endB = parsePeriodRange(formatCareerPeriod(b))?.end || 0;
      return endB - endA;
    });

    const primary = sortedEntries[0];
    const linked = new Map<string, Activity>();

    sortedEntries.forEach((entry) => {
      getLinkedActivities(entry, activities).forEach((activity) => {
        linked.set(activity.id, activity);
      });
    });

    const linkedActivities = [...linked.values()].sort((a, b) => getActivitySortValue(b) - getActivitySortValue(a));

    manualCards.push({
      company: primary.company || "미입력",
      position: primary.position || "미입력",
      period: formatCareerPeriod(primary) || "미입력",
      activities: linkedActivities,
    });
  });

  return manualCards.sort((a, b) => {
    const endA = parsePeriodRange(a.period)?.end || 0;
    const endB = parsePeriodRange(b.period)?.end || 0;
    return endB - endA;
  });
}
