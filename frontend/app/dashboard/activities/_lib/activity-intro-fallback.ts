import type { ActivityEvidenceSource } from "./activity-evidence";
import { compactEvidenceText, normalizeEvidenceList } from "./activity-evidence";

function joinLeadParts(parts: string[]): string {
  return parts.filter(Boolean).join(" ");
}

function summarizeContributions(contributions: string[]): string {
  if (contributions.length === 0) return "";
  if (contributions.length === 1) return contributions[0];
  return `${contributions[0]} 등 ${contributions.length}개 핵심 기여`;
}

export function buildActivityIntroFallbackCandidates(source: ActivityEvidenceSource): string[] {
  const title = compactEvidenceText(source.title);
  const type = compactEvidenceText(source.type);
  const organization = compactEvidenceText(source.organization);
  const period = compactEvidenceText(source.period);
  const myRole = compactEvidenceText(source.myRole);
  const description = compactEvidenceText(source.description);
  const skills = normalizeEvidenceList(source.skills).slice(0, 4);
  const contributions = normalizeEvidenceList(source.contributions);
  const contributionSummary = summarizeContributions(contributions);

  const lead = joinLeadParts([
    title || organization || "해당 활동",
    type ? `${type}에서` : "에서",
    myRole ? `${myRole}로 참여해` : "주요 담당자로 참여해",
  ]);
  const impact = contributionSummary || description || "주요 과제를 수행했습니다";
  const skillPhrase = skills.length > 0 ? ` ${skills.join(", ")}을 활용해 실행 과정을 구체화했습니다.` : "";
  const periodPhrase = period ? ` 활동 기간은 ${period}입니다.` : "";

  const candidates = [
    `${lead} ${impact}을 중심으로 문제 해결에 기여했습니다.${skillPhrase}${periodPhrase}`,
  ];

  if (description && !candidates[0].includes(description)) {
    candidates.push(`${description} ${myRole ? `${myRole} 역할로 ` : ""}${contributionSummary || "핵심 실행 과제"}를 맡아 활동의 완성도를 높였습니다.`);
  }

  return candidates.map((candidate) => candidate.replace(/\s+/g, " ").trim()).filter(Boolean).slice(0, 2);
}
