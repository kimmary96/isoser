import { chips } from "./_content";

function takeFirst(value?: string | string[]): string {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export function normalizeChip(value?: string | string[]): string {
  const chip = takeFirst(value).trim();
  return chips.includes(chip) ? chip : "전체";
}

export function normalizeKeyword(value?: string | string[]): string {
  return takeFirst(value).trim();
}
