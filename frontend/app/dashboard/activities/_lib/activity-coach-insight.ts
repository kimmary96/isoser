import type { CoachFeedbackResponse, RewriteSuggestion, StructureDiagnosis } from "@/lib/types";

type DiagnosisKey =
  | "overview"
  | "problem_definition"
  | "tech_decision"
  | "implementation_detail"
  | "quantified_result"
  | "role_clarification";

type DiagnosisStatus = "strong" | "missing";

export type ActivityCoachQuestion = {
  id: string;
  missingElement: string;
  question: string;
};

export type ActivityCoachDiagnosisItem = {
  key: DiagnosisKey;
  label: string;
  status: DiagnosisStatus;
  reason: string;
  priority: boolean;
};

export type ActivityCoachRewriteCandidate = {
  id: string;
  text: string;
  focus: RewriteSuggestion["focus"];
  section: string;
  rationale: string;
  referencePattern: string | null;
  needsUserCheck: boolean;
  starTarget: ActivityCoachStarTarget;
  starTargetLabel: string;
};

export type ActivityCoachRiskFlag = {
  id: string;
  label: string;
  description: string;
};

export type ActivityCoachStrengthPoint = {
  id: string;
  label: string;
  description: string;
};

export type ActivityCoachInsightContext = {
  targetRole?: string;
  activityTitle?: string;
  activityType?: string;
  myRole?: string;
  skills?: string[];
  contributions?: string[];
  starSituation?: string;
  starTask?: string;
  starAction?: string;
  starResult?: string;
};

export type ActivityCoachInsight = {
  hasInsight: boolean;
  priorityFocus: string | null;
  missingElements: string[];
  roleKeywords: string[];
  strengthPoints: ActivityCoachStrengthPoint[];
  diagnosisItems: ActivityCoachDiagnosisItem[];
  questions: ActivityCoachQuestion[];
  rewriteCandidates: ActivityCoachRewriteCandidate[];
  riskFlags: ActivityCoachRiskFlag[];
};

export type ActivityCoachStarTarget = "situation" | "task" | "action" | "result";

const DIAGNOSIS_DEFINITIONS: Array<{
  key: DiagnosisKey;
  label: string;
  missingElement: string;
  diagnosisField?: keyof Pick<
    StructureDiagnosis,
    | "has_problem_definition"
    | "has_tech_decision"
    | "has_quantified_result"
    | "has_role_clarification"
    | "has_implementation_detail"
  >;
  strongReason: string;
  missingReason: string;
}> = [
  {
    key: "overview",
    label: "프로젝트 개요",
    missingElement: "프로젝트 개요",
    strongReason: "활동의 기본 맥락이 드러납니다.",
    missingReason: "활동명, 기간, 역할 같은 기본 맥락을 먼저 보강해야 합니다.",
  },
  {
    key: "problem_definition",
    label: "문제 정의",
    missingElement: "문제 정의",
    diagnosisField: "has_problem_definition",
    strongReason: "해결하려던 문제가 드러납니다.",
    missingReason: "처음에 어떤 문제나 비효율이 있었는지 더 적어야 합니다.",
  },
  {
    key: "tech_decision",
    label: "기술 선택 근거",
    missingElement: "기술 선택 근거",
    diagnosisField: "has_tech_decision",
    strongReason: "선택한 방식의 이유가 드러납니다.",
    missingReason: "왜 그 기술이나 방식을 선택했는지 근거가 부족합니다.",
  },
  {
    key: "implementation_detail",
    label: "구현 디테일",
    missingElement: "구현 디테일",
    diagnosisField: "has_implementation_detail",
    strongReason: "실행 방식과 구현 내용이 드러납니다.",
    missingReason: "어떻게 설계하고 실행했는지 구체성이 더 필요합니다.",
  },
  {
    key: "quantified_result",
    label: "정량적 성과",
    missingElement: "정량적 성과",
    diagnosisField: "has_quantified_result",
    strongReason: "결과를 수치나 크기로 판단할 수 있습니다.",
    missingReason: "성과의 크기를 보여줄 숫자나 비교 기준이 부족합니다.",
  },
  {
    key: "role_clarification",
    label: "역할 명확화",
    missingElement: "역할 명확화",
    diagnosisField: "has_role_clarification",
    strongReason: "팀 안에서 맡은 범위가 드러납니다.",
    missingReason: "팀 규모와 본인이 맡은 역할을 더 명확히 적어야 합니다.",
  },
];

const QUESTION_BY_MISSING_ELEMENT: Record<string, string> = {
  "프로젝트 개요": "활동 기간, 팀 규모, 본인 역할을 한 문장으로 적으면 어떻게 정리할 수 있나요?",
  "문제 정의": "처음에 어떤 문제, 불편, 비효율, 한계를 해결하려고 했나요?",
  "기술 선택 근거": "왜 그 기술이나 방식을 선택했고, 비교했던 다른 대안이 있었나요?",
  "구현 디테일": "직접 설계하거나 실행한 과정 중 가장 구체적으로 설명할 수 있는 부분은 무엇인가요?",
  "정량적 성과": "결과를 숫자, 비율, 시간, 건수, 비용, 참여자 수 등으로 표현할 수 있나요?",
  "역할 명확화": "팀 전체 작업 중 본인이 직접 맡은 범위와 의사결정한 부분은 어디까지였나요?",
};

function normalizeTextList(values: string[] | undefined): string[] {
  if (!Array.isArray(values)) return [];

  const normalized: string[] = [];
  for (const value of values) {
    const text = value.trim();
    if (text && !normalized.includes(text)) {
      normalized.push(text);
    }
  }

  return normalized;
}

function isDefinitionMissing(
  definition: (typeof DIAGNOSIS_DEFINITIONS)[number],
  diagnosis: StructureDiagnosis,
  missingElements: string[]
): boolean {
  if (missingElements.includes(definition.missingElement)) return true;
  if (!definition.diagnosisField) return false;
  return diagnosis[definition.diagnosisField] === false;
}

function buildDiagnosisItems(
  diagnosis: StructureDiagnosis,
  missingElements: string[]
): ActivityCoachDiagnosisItem[] {
  const priorityFocus = diagnosis.priority_focus;

  return DIAGNOSIS_DEFINITIONS.map((definition) => {
    const missing = isDefinitionMissing(definition, diagnosis, missingElements);

    return {
      key: definition.key,
      label: definition.label,
      status: missing ? "missing" : "strong",
      reason: missing ? definition.missingReason : definition.strongReason,
      priority: priorityFocus === definition.missingElement,
    };
  });
}

function buildQuestions(missingElements: string[]): ActivityCoachQuestion[] {
  return missingElements
    .map((missingElement) => {
      const question = QUESTION_BY_MISSING_ELEMENT[missingElement];
      if (!question) return null;

      return {
        id: `question-${missingElement}`,
        missingElement,
        question,
      };
    })
    .filter((item): item is ActivityCoachQuestion => Boolean(item));
}

function buildRewriteCandidates(
  suggestions: RewriteSuggestion[] | undefined
): ActivityCoachRewriteCandidate[] {
  if (!Array.isArray(suggestions)) return [];

  return suggestions
    .map((suggestion, index) => {
      const text = sanitizeRewriteCandidateText(suggestion);
      if (!text) return null;
      const starTarget = resolveStarTarget(suggestion);

      return {
        id: `rewrite-${index + 1}-${suggestion.focus}`,
        text,
        focus: suggestion.focus,
        section: suggestion.section.trim() || "개선 문장",
        rationale: suggestion.rationale.trim(),
        referencePattern: suggestion.reference_pattern?.trim() || null,
        needsUserCheck: suggestion.focus === "quantification" || suggestion.text.includes("수치"),
        starTarget,
        starTargetLabel: STAR_TARGET_LABELS[starTarget],
      };
    })
    .filter((candidate): candidate is ActivityCoachRewriteCandidate => Boolean(candidate));
}

const MISSING_ELEMENT_FOCUS: Partial<Record<string, RewriteSuggestion["focus"]>> = {
  "프로젝트 개요": "job_fit",
  "문제 정의": "problem_definition",
  "기술 선택 근거": "tech_decision",
  "구현 디테일": "verb_strength",
  "정량적 성과": "quantification",
  "역할 명확화": "job_fit",
};

const MISSING_ELEMENT_STAR_TARGET: Partial<Record<string, ActivityCoachStarTarget>> = {
  "프로젝트 개요": "situation",
  "문제 정의": "situation",
  "기술 선택 근거": "action",
  "구현 디테일": "action",
  "정량적 성과": "result",
  "역할 명확화": "action",
};

function buildQuestionAnswerCandidates(
  missingElements: string[],
  context: ActivityCoachInsightContext | undefined
): ActivityCoachRewriteCandidate[] {
  return missingElements
    .map((missingElement, index) => {
      const focus = MISSING_ELEMENT_FOCUS[missingElement];
      const starTarget = MISSING_ELEMENT_STAR_TARGET[missingElement];
      const question = QUESTION_BY_MISSING_ELEMENT[missingElement];
      if (!focus || !starTarget || !question) return null;

      const text = buildQuestionAnswerCandidateText(missingElement, context);
      if (!text) return null;

      const candidate: ActivityCoachRewriteCandidate = {
        id: `question-answer-${index + 1}-${focus}`,
        text,
        focus,
        section: missingElement,
        rationale: `보강 질문 "${question}"에 답하는 예시입니다.`,
        referencePattern: null,
        needsUserCheck: missingElement === "정량적 성과" || missingElement === "기술 선택 근거",
        starTarget,
        starTargetLabel: STAR_TARGET_LABELS[starTarget],
      };

      return candidate;
    })
    .filter((candidate): candidate is ActivityCoachRewriteCandidate => Boolean(candidate));
}

function buildQuestionAnswerCandidateText(
  missingElement: string,
  context: ActivityCoachInsightContext | undefined
): string | null {
  const activityTitle = context?.activityTitle?.trim() || "이 프로젝트";
  const activityType = context?.activityType?.trim() || "활동";
  const myRole = context?.myRole?.trim();
  const targetRole = context?.targetRole?.trim();
  const skills = normalizeTextList(context?.skills);
  const contributions = normalizeTextList(context?.contributions);
  const primarySkill = skills[0] || "선택한 기술";
  const secondarySkill = skills.find((skill) => skill !== primarySkill);
  const primaryContribution = contributions[0] || context?.starAction?.trim() || "핵심 기능 구현";
  const result = context?.starResult?.trim();
  const situation = context?.starSituation?.trim();
  const task = context?.starTask?.trim();
  const action = context?.starAction?.trim();
  const rolePhrase = myRole || targetRole || "담당자";

  if (missingElement === "프로젝트 개요") {
    return truncateCandidateText(
      `${activityTitle}는 ${activityType} 경험으로, ${rolePhrase} 역할에서 ${primaryContribution}을 맡아 문제 해결과 성과 창출에 기여했습니다.`
    );
  }

  if (missingElement === "문제 정의") {
    const problem = situation || task || "기존 방식의 지연과 운영 비효율";
    return truncateCandidateText(
      `${activityTitle}에서는 ${problem}을 해결하는 것이 핵심 과제였고, 이를 줄이기 위해 ${primaryContribution} 작업을 우선 개선했습니다.`
    );
  }

  if (missingElement === "기술 선택 근거") {
    const alternative = secondarySkill ? `${secondarySkill} 중심 구현` : "단순 DB 조회나 순차 처리 방식";
    return truncateCandidateText(
      `${primarySkill}은 ${primaryContribution} 과정에서 우선순위 변경과 상태 갱신을 안정적으로 처리하기 위해 선택했습니다. ${alternative}보다 실시간 변화에 빠르게 대응할 수 있어 현재 방식이 더 적합했습니다.`
    );
  }

  if (missingElement === "구현 디테일") {
    const implementation = action || primaryContribution;
    return truncateCandidateText(
      `${implementation} 과정에서 데이터 흐름, 예외 처리, 상태 동기화 기준을 직접 설계해 실제 사용자가 겪는 지연과 오류를 줄였습니다.`
    );
  }

  if (missingElement === "정량적 성과") {
    if (result) {
      return truncateCandidateText(
        `${result}처럼 결과가 드러나므로, 처리량·시간·완료율 중 가장 중요한 지표를 앞에 배치해 성과 크기를 먼저 보여주면 좋습니다.`
      );
    }

    return "처리 시간, 완료율, 오류율, 사용자 수처럼 전후 비교가 가능한 지표를 1개 이상 넣으면 성과의 크기가 분명해집니다.";
  }

  if (missingElement === "역할 명확화") {
    return truncateCandidateText(
      `${rolePhrase}로서 ${primaryContribution}을 직접 맡았고, 팀 전체 성과 중 본인이 설계·구현·판단한 범위를 분리해 설명하면 좋습니다.`
    );
  }

  return null;
}

function mergeRewriteCandidates(
  questionAnswerCandidates: ActivityCoachRewriteCandidate[],
  rewriteCandidates: ActivityCoachRewriteCandidate[]
): ActivityCoachRewriteCandidate[] {
  const answeredFocuses = new Set(questionAnswerCandidates.map((candidate) => candidate.focus));
  const filteredRewriteCandidates = rewriteCandidates.filter((candidate) => !answeredFocuses.has(candidate.focus));

  return [...questionAnswerCandidates, ...filteredRewriteCandidates].slice(0, 4);
}

const CONTEXT_LABEL_PATTERN =
  /^\s*(지원 직무|목표 직무|활동명|활동 유형|조직|기간|팀 규모|팀 구성|내 역할|사용 기술\/도구|사용 기술|기여 내용|STAR Situation|STAR Task|STAR Action|STAR Result|Situation|Task|Action|Result)\s*:/i;
const INLINE_CONTEXT_LABEL_PATTERN =
  /\b(지원 직무|목표 직무|활동명|활동 유형|조직|기간|팀 규모|팀 구성|내 역할|사용 기술\/도구|사용 기술|기여 내용|STAR Situation|STAR Task|STAR Action|STAR Result)\s*:/i;
const GENERATED_SENTENCE_HINT_PATTERN = /(개선|단축|달성|선택|비교|설계|구축|개발|동기화|처리|높였|줄였|드러냈|연결했|보여주|실행|주도|확장성|효율|성과)/;
const KOREAN_SENTENCE_END_PATTERN = /(?<=[.!?。])/;

function isStarStructureDuplicate(suggestion: RewriteSuggestion): boolean {
  return suggestion.focus === "star_gap" || /STAR\s*구조|STAR structure/i.test(suggestion.section);
}

function sanitizeRewriteCandidateText(suggestion: RewriteSuggestion): string | null {
  if (isStarStructureDuplicate(suggestion)) return null;

  const rawText = suggestion.text.trim();
  if (!rawText) return null;
  const sourceText = extractCandidateSourceText(rawText);

  const sentence = extractGeneratedSentence(sourceText);
  if (sentence) return sentence;

  const compact = sourceText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line && !CONTEXT_LABEL_PATTERN.test(line) && !line.startsWith("- "))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();

  return truncateCandidateText(stripLeadingContextLabel(compact));
}

function extractCandidateSourceText(text: string): string {
  const starResultMatch = text.match(/(?:STAR\s*)?Result\s*:\s*([\s\S]+)$/i);
  if (starResultMatch?.[1]) return starResultMatch[1].trim();

  const inlineContextLinePattern = new RegExp(
    `[^.\\n]{0,80}${INLINE_CONTEXT_LABEL_PATTERN.source}[^.\\n]*(?:\\.|\\n|$)`,
    "gi"
  );
  return text.replace(inlineContextLinePattern, " ").trim();
}

function extractGeneratedSentence(text: string): string | null {
  const normalized = text.replace(/\r?\n+/g, " ").replace(/\s+/g, " ").trim();
  const sentenceCandidates = normalized
    .split(KOREAN_SENTENCE_END_PATTERN)
    .map((sentence) => stripLeadingContextLabel(sentence.trim()))
    .filter((sentence) => sentence.length >= 20);

  const generatedSentence = [...sentenceCandidates]
    .reverse()
    .find((sentence) => GENERATED_SENTENCE_HINT_PATTERN.test(sentence) && !INLINE_CONTEXT_LABEL_PATTERN.test(sentence));

  if (generatedSentence) return truncateCandidateText(generatedSentence);

  return null;
}

function stripLeadingContextLabel(text: string): string {
  return text.replace(/^\s*(성과|Result|STAR Result)\s*:\s*/i, "").trim();
}

function truncateCandidateText(text: string | null): string | null {
  if (!text) return null;
  const normalized = text.replace(/\s+/g, " ").trim();
  if (!normalized) return null;
  if (normalized.length <= 260) return normalized;
  return `${normalized.slice(0, 257).trim()}...`;
}

const STAR_TARGET_LABELS: Record<ActivityCoachStarTarget, string> = {
  situation: "Situation",
  task: "Task",
  action: "Action",
  result: "Result",
};

function resolveStarTarget(suggestion: RewriteSuggestion): ActivityCoachStarTarget {
  const section = suggestion.section.trim();

  if (/결과|성과|수치|정량|result/i.test(section)) return "result";
  if (/상황|문제|배경|situation/i.test(section)) return "situation";
  if (/과제|목표|task/i.test(section)) return "task";
  if (/행동|실행|구현|기술|action/i.test(section)) return "action";

  if (suggestion.focus === "quantification") return "result";
  if (suggestion.focus === "problem_definition") return "situation";
  if (suggestion.focus === "tech_decision" || suggestion.focus === "verb_strength") return "action";
  if (suggestion.focus === "job_fit") return "action";
  return "task";
}

function buildRiskFlags(missingElements: string[]): ActivityCoachRiskFlag[] {
  const flags: ActivityCoachRiskFlag[] = [];

  if (missingElements.includes("정량적 성과")) {
    flags.push({
      id: "missing-quantified-result",
      label: "수치 보완 필요",
      description: "성과 후보 문장에 숫자가 들어가면 사용자 확인이 필요합니다.",
    });
  }

  if (missingElements.includes("역할 명확화")) {
    flags.push({
      id: "missing-role-clarification",
      label: "역할 확인 필요",
      description: "팀 작업을 본인 성과처럼 과장하지 않도록 담당 범위를 확인해야 합니다.",
    });
  }

  if (missingElements.includes("기술 선택 근거")) {
    flags.push({
      id: "missing-tech-decision",
      label: "선택 근거 부족",
      description: "기술명만 넣기보다 선택 이유와 대안을 함께 보강해야 합니다.",
    });
  }

  return flags;
}

function getDiagnosisStatus(items: ActivityCoachDiagnosisItem[], key: DiagnosisKey): DiagnosisStatus | null {
  return items.find((item) => item.key === key)?.status ?? null;
}

function splitRoleKeywords(targetRole: string | undefined): string[] {
  const role = targetRole?.trim();
  if (!role) return [];

  return role
    .split(/[\s,/|·]+/)
    .map((keyword) => keyword.trim())
    .filter((keyword) => keyword.length >= 2);
}

function buildRoleKeywords(context: ActivityCoachInsightContext | undefined): string[] {
  const keywords = [
    ...splitRoleKeywords(context?.targetRole),
    ...normalizeTextList(context?.skills).slice(0, 4),
    ...(context?.myRole?.trim() ? [context.myRole.trim()] : []),
  ];

  return normalizeTextList(keywords).slice(0, 6);
}

function buildStrengthPoints(
  diagnosisItems: ActivityCoachDiagnosisItem[],
  rewriteCandidates: ActivityCoachRewriteCandidate[],
  context: ActivityCoachInsightContext | undefined
): ActivityCoachStrengthPoint[] {
  const points: ActivityCoachStrengthPoint[] = [];
  const targetRole = context?.targetRole?.trim();
  const skills = normalizeTextList(context?.skills);
  const contributions = normalizeTextList(context?.contributions);
  const myRole = context?.myRole?.trim();

  if (targetRole) {
    points.push({
      id: "target-role-fit",
      label: "직무 기준 고정",
      description: `${targetRole} 관점으로 표현, 키워드, 강조 순서를 맞출 수 있습니다.`,
    });
  }

  if (myRole && getDiagnosisStatus(diagnosisItems, "role_clarification") === "strong") {
    points.push({
      id: "role-evidence",
      label: "내 역할 근거",
      description: `${myRole} 역할을 중심으로 팀 성과와 개인 기여를 분리해 쓸 수 있습니다.`,
    });
  }

  if (skills.length > 0 && getDiagnosisStatus(diagnosisItems, "implementation_detail") === "strong") {
    points.push({
      id: "skill-evidence",
      label: "기술/실행 근거",
      description: `${skills.slice(0, 3).join(", ")} 기반의 실행 과정을 직무 역량으로 연결할 수 있습니다.`,
    });
  }

  if (contributions.length > 0) {
    points.push({
      id: "contribution-evidence",
      label: "기여 내용 근거",
      description: `${contributions.length}개 기여 내용을 이력서 bullet이나 포트폴리오 섹션으로 확장할 수 있습니다.`,
    });
  }

  if (getDiagnosisStatus(diagnosisItems, "quantified_result") === "strong") {
    points.push({
      id: "result-evidence",
      label: "성과 강조 가능",
      description: "결과 근거가 있어 문장 후보를 성과 중심으로 다듬기 좋습니다.",
    });
  }

  if (rewriteCandidates.some((candidate) => candidate.focus === "job_fit")) {
    points.push({
      id: "job-fit-rewrite",
      label: "직무 연결 후보",
      description: "코치가 직무 적합성 관점의 문장 후보를 제안했습니다.",
    });
  }

  return points.slice(0, 4);
}

export function buildActivityCoachInsight(
  response: CoachFeedbackResponse | null | undefined,
  context?: ActivityCoachInsightContext
): ActivityCoachInsight {
  if (!response) {
    return {
      hasInsight: false,
      priorityFocus: null,
      missingElements: [],
      roleKeywords: [],
      strengthPoints: [],
      diagnosisItems: [],
      questions: [],
      rewriteCandidates: [],
      riskFlags: [],
    };
  }

  const missingElements = normalizeTextList([
    ...response.missing_elements,
    ...response.structure_diagnosis.missing_elements,
  ]);
  const diagnosisItems = buildDiagnosisItems(response.structure_diagnosis, missingElements);
  const questionAnswerCandidates = buildQuestionAnswerCandidates(missingElements, context);
  const rewriteCandidates = mergeRewriteCandidates(
    questionAnswerCandidates,
    buildRewriteCandidates(response.rewrite_suggestions)
  );
  const roleKeywords = buildRoleKeywords(context);
  const strengthPoints = buildStrengthPoints(diagnosisItems, rewriteCandidates, context);

  return {
    hasInsight: diagnosisItems.length > 0 || rewriteCandidates.length > 0 || strengthPoints.length > 0,
    priorityFocus: response.structure_diagnosis.priority_focus || missingElements[0] || null,
    missingElements,
    roleKeywords,
    strengthPoints,
    diagnosisItems,
    questions: buildQuestions(missingElements),
    rewriteCandidates,
    riskFlags: buildRiskFlags(missingElements),
  };
}
