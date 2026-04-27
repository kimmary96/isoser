import type { ActivityEvidenceSource } from "./activity-evidence";
import {
  compactEvidenceText,
  hasActivityEvidenceSource,
  normalizeEvidenceList,
} from "./activity-evidence";

export type ActivityStarImportSource = ActivityEvidenceSource;

export type ActivityStarImportDraft = {
  situation: string;
  task: string;
  action: string;
  result: string;
};

const RESULT_PATTERN = /(\d[\d,.]*\s*(?:%|퍼센트|건|명|원|배|초|분|시간)|달성|향상|증가|감소|단축|절감|처리|완료율|전환율|유지율|리텐션|매출|비용|장애\s*0|성과)/;
const ACTION_PATTERN = /(개발|구현|설계|구축|도입|운영|개선|분석|기획|제작|연동|자동화|배포|테스트|관리|작성|정리|동기화|마이그레이션|리팩토링|인터뷰|검증)/;
const TASK_PATTERN = /(목표|과제|문제|이슈|요구|필요|해결|담당|책임|개선해야|줄여야|높여야|만들어야)/;
const SITUATION_PATTERN = /(기존|당시|배경|상황|초기|운영 중|출시|사용자|고객|팀|프로젝트|서비스)/;

function toBulletList(items: string[]): string {
  return items.map((item) => `- ${item}`).join("\n");
}

function classifyContribution(text: string): keyof ActivityStarImportDraft {
  if (RESULT_PATTERN.test(text)) return "result";
  if (ACTION_PATTERN.test(text)) return "action";
  if (TASK_PATTERN.test(text)) return "task";
  if (SITUATION_PATTERN.test(text)) return "situation";
  return "action";
}

export function hasActivityStarImportSource(source: ActivityStarImportSource): boolean {
  return hasActivityEvidenceSource(source);
}

export function buildActivityStarImportDraft(source: ActivityStarImportSource): ActivityStarImportDraft {
  const title = compactEvidenceText(source.title);
  const type = compactEvidenceText(source.type);
  const organization = compactEvidenceText(source.organization);
  const period = compactEvidenceText(source.period);
  const teamComposition = compactEvidenceText(source.teamComposition);
  const myRole = compactEvidenceText(source.myRole);
  const description = compactEvidenceText(source.description);
  const skills = normalizeEvidenceList(source.skills);
  const contributions = normalizeEvidenceList(source.contributions);

  const grouped: Record<keyof ActivityStarImportDraft, string[]> = {
    situation: [],
    task: [],
    action: [],
    result: [],
  };

  for (const contribution of contributions) {
    grouped[classifyContribution(contribution)].push(contribution);
  }

  const contextLines = [
    title ? `${title}${type ? ` (${type})` : ""}` : "",
    organization || period ? `${organization || "소속 미기재"}${period ? ` / ${period}` : ""}` : "",
    source.teamSize && source.teamSize > 0 ? `팀 규모 ${source.teamSize}명${teamComposition ? ` (${teamComposition})` : ""}` : teamComposition,
    myRole ? `내 역할: ${myRole}` : "",
  ].filter(Boolean);

  const taskLines = [
    myRole ? `${myRole} 역할에서 해결해야 할 핵심 과제를 맡았습니다.` : "",
    ...grouped.task,
  ].filter(Boolean);

  const actionLines = [
    ...grouped.action,
    skills.length > 0 ? `사용 기술/도구: ${skills.join(", ")}` : "",
  ].filter(Boolean);

  return {
    situation: [contextLines.join("\n"), description, toBulletList(grouped.situation)].filter(Boolean).join("\n\n"),
    task: toBulletList(taskLines),
    action: toBulletList(actionLines),
    result: toBulletList(grouped.result),
  };
}
