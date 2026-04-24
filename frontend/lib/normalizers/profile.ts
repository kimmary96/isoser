const REGION_ALIASES: Array<{ region: string; aliases: string[] }> = [
  { region: "서울", aliases: ["서울특별시", "서울시", "서울"] },
  { region: "경기", aliases: ["경기도", "경기"] },
  { region: "인천", aliases: ["인천광역시", "인천시", "인천"] },
  { region: "부산", aliases: ["부산광역시", "부산시", "부산"] },
  { region: "대구", aliases: ["대구광역시", "대구시", "대구"] },
  { region: "광주", aliases: ["광주광역시", "광주시", "광주"] },
  { region: "대전", aliases: ["대전광역시", "대전시", "대전"] },
  { region: "울산", aliases: ["울산광역시", "울산시", "울산"] },
  { region: "세종", aliases: ["세종특별자치시", "세종시", "세종"] },
  { region: "강원", aliases: ["강원특별자치도", "강원도", "강원"] },
  { region: "충북", aliases: ["충청북도", "충북"] },
  { region: "충남", aliases: ["충청남도", "충남"] },
  { region: "전북", aliases: ["전북특별자치도", "전라북도", "전북"] },
  { region: "전남", aliases: ["전라남도", "전남"] },
  { region: "경북", aliases: ["경상북도", "경북"] },
  { region: "경남", aliases: ["경상남도", "경남"] },
  { region: "제주", aliases: ["제주특별자치도", "제주도", "제주"] },
];

export function compactProfileText(value: unknown): string | null {
  const text = String(value ?? "").replace(/\s+/g, " ").trim();
  return text || null;
}

export function normalizeTargetJobText(value: unknown): string | null {
  const text = compactProfileText(value);
  return text ? text.toLowerCase() : null;
}

export function buildTargetJobFields(value: unknown): {
  target_job: string | null;
  target_job_normalized: string | null;
} {
  const targetJob = compactProfileText(value);
  return {
    target_job: targetJob,
    target_job_normalized: normalizeTargetJobText(targetJob),
  };
}

function extractRegionDetail(address: string, region: string | null): string | null {
  const tokens = address.split(/\s+/).map((token) => token.trim()).filter(Boolean);
  const regionAliasSet = new Set(
    REGION_ALIASES.flatMap((entry) => (entry.region === region ? [entry.region, ...entry.aliases] : []))
  );
  const detail = tokens.find((token) => {
    const normalized = token.replace(/[(),]/g, "");
    return !regionAliasSet.has(normalized) && /(시|군|구)$/.test(normalized) && normalized.length >= 2;
  });

  return detail?.replace(/[(),]/g, "") ?? null;
}

export function parseProfileAddress(value: unknown): {
  address: string | null;
  region: string | null;
  region_detail: string | null;
} {
  const address = compactProfileText(value);
  if (!address) {
    return { address: null, region: null, region_detail: null };
  }

  const compactAddress = address.replace(/\s+/g, "");
  const match = REGION_ALIASES.find((entry) =>
    entry.aliases.some((alias) => compactAddress.includes(alias.replace(/\s+/g, "")))
  );
  const region = match?.region ?? null;

  return {
    address,
    region,
    region_detail: extractRegionDetail(address, region),
  };
}

export function resolveProfileTargetJob(profile: {
  target_job?: string | null;
  bio?: string | null;
} | null | undefined): string | null {
  return compactProfileText(profile?.target_job) ?? compactProfileText(profile?.bio);
}
