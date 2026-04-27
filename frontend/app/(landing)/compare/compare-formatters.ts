export function normalizeTextList(value: string[] | string | null | undefined): string[] {
  if (Array.isArray(value)) {
    return value.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

export function formatCompareDateLabel(value: string | null | undefined): string {
  if (!value) return "정보 없음";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString("ko-KR", { month: "long", day: "numeric" });
}

export function formatCompareDateRange(startDate?: string | null, endDate?: string | null): string {
  if (startDate && endDate) {
    return `${formatCompareDateLabel(startDate)} ~ ${formatCompareDateLabel(endDate)}`;
  }
  if (startDate) {
    return `${formatCompareDateLabel(startDate)} 시작`;
  }
  if (endDate) {
    return `${formatCompareDateLabel(endDate)} 종료`;
  }
  return "데이터 미수집";
}

export function getCompareText(value: string | null | undefined): string {
  return typeof value === "string" && value.trim() ? value.trim() : "정보 없음";
}

export function getCompareOperationalText(value: string | null | undefined): string {
  return typeof value === "string" && value.trim() ? value.trim() : "데이터 미수집";
}

export function getFirstCompareText(...values: Array<string | number | null | undefined>): string | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

export function joinUniqueCompareText(values: Array<string | number | null | undefined>, separator = ", "): string {
  const items = values
    .map((value) => (value === null || value === undefined ? "" : String(value).trim()))
    .filter(Boolean);
  const uniqueItems = items.filter((item, index) => items.indexOf(item) === index);
  return uniqueItems.length > 0 ? uniqueItems.join(separator) : "데이터 미수집";
}

export function formatCompareMoney(value: number | string | null | undefined): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value === 0) return "무료";
    return `${value.toLocaleString("ko-KR")}원`;
  }
  if (typeof value === "string" && value.trim()) {
    const numericValue = Number(value.replace(/[^\d.-]/g, ""));
    if (Number.isFinite(numericValue) && value.trim() !== "") {
      if (numericValue === 0) return "무료";
      return `${numericValue.toLocaleString("ko-KR")}원`;
    }
    return value.trim();
  }
  return null;
}
