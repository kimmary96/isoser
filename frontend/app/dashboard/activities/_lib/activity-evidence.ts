export type ActivityEvidenceSource = {
  title?: string;
  type?: string;
  organization?: string;
  period?: string;
  teamSize?: number;
  teamComposition?: string;
  myRole?: string;
  skills?: string[];
  contributions?: string[];
  description?: string;
};

export function compactEvidenceText(value: string | undefined | null): string {
  return value?.replace(/\s+/g, " ").trim() ?? "";
}

export function normalizeEvidenceList(values: string[] | undefined): string[] {
  if (!Array.isArray(values)) return [];

  const normalized: string[] = [];
  for (const value of values) {
    const text = compactEvidenceText(value).replace(/^[-•]\s*/, "");
    if (text && !normalized.includes(text)) normalized.push(text);
  }

  return normalized;
}

export function hasActivityEvidenceSource(source: ActivityEvidenceSource): boolean {
  return Boolean(
    compactEvidenceText(source.title) ||
      compactEvidenceText(source.organization) ||
      compactEvidenceText(source.period) ||
      compactEvidenceText(source.myRole) ||
      compactEvidenceText(source.description) ||
      normalizeEvidenceList(source.skills).length > 0 ||
      normalizeEvidenceList(source.contributions).length > 0
  );
}

export function buildActivityEvidenceText(source: ActivityEvidenceSource): string {
  const title = compactEvidenceText(source.title);
  const type = compactEvidenceText(source.type);
  const organization = compactEvidenceText(source.organization);
  const period = compactEvidenceText(source.period);
  const teamComposition = compactEvidenceText(source.teamComposition);
  const myRole = compactEvidenceText(source.myRole);
  const description = compactEvidenceText(source.description);
  const skills = normalizeEvidenceList(source.skills);
  const contributions = normalizeEvidenceList(source.contributions);

  return [
    title ? `활동명: ${title}` : "",
    type ? `활동 유형: ${type}` : "",
    organization ? `조직: ${organization}` : "",
    period ? `기간: ${period}` : "",
    source.teamSize && source.teamSize > 0 ? `팀 규모: ${source.teamSize}명` : "",
    teamComposition ? `팀 구성: ${teamComposition}` : "",
    myRole ? `내 역할: ${myRole}` : "",
    skills.length > 0 ? `사용 기술/도구: ${skills.join(", ")}` : "",
    contributions.length > 0 ? `기여 내용:\n- ${contributions.join("\n- ")}` : "",
    description ? `소개글:\n${description}` : "",
  ]
    .filter(Boolean)
    .join("\n");
}
