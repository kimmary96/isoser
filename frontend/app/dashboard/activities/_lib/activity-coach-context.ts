import type { Activity } from "@/lib/types";

type ActivityCoachContextInput = {
  targetRole?: string;
  title?: string;
  type?: Activity["type"] | string;
  organization?: string;
  period?: string;
  teamSize?: number;
  teamComposition?: string;
  myRole?: string;
  skills?: string[];
  contributions?: string[];
  description?: string;
  starSituation?: string;
  starTask?: string;
  starAction?: string;
  starResult?: string;
  fallbackText?: string;
};

const compact = (value: string | null | undefined) => value?.trim() ?? "";

const formatList = (items: string[] | undefined) =>
  (items ?? [])
    .map((item) => item.trim())
    .filter(Boolean);

export function buildActivityCoachContext(input: ActivityCoachContextInput): string {
  const contributions = formatList(input.contributions);
  const skills = formatList(input.skills);
  const lines = [
    compact(input.targetRole) ? `지원 직무: ${compact(input.targetRole)}` : "",
    compact(input.title) ? `활동명: ${compact(input.title)}` : "",
    compact(input.type) ? `활동 유형: ${compact(input.type)}` : "",
    compact(input.organization) ? `조직: ${compact(input.organization)}` : "",
    compact(input.period) ? `기간: ${compact(input.period)}` : "",
    input.teamSize && input.teamSize > 0 ? `팀 규모: ${input.teamSize}명` : "",
    compact(input.teamComposition) ? `팀 구성: ${compact(input.teamComposition)}` : "",
    compact(input.myRole) ? `내 역할: ${compact(input.myRole)}` : "",
    skills.length > 0 ? `사용 기술/도구: ${skills.join(", ")}` : "",
    contributions.length > 0 ? `기여 내용:\n- ${contributions.join("\n- ")}` : "",
    compact(input.description) ? `소개글:\n${compact(input.description)}` : "",
    compact(input.starSituation) ? `STAR Situation:\n${compact(input.starSituation)}` : "",
    compact(input.starTask) ? `STAR Task:\n${compact(input.starTask)}` : "",
    compact(input.starAction) ? `STAR Action:\n${compact(input.starAction)}` : "",
    compact(input.starResult) ? `STAR Result:\n${compact(input.starResult)}` : "",
  ].filter(Boolean);

  if (lines.length > 0) return lines.join("\n\n");
  return compact(input.fallbackText);
}
