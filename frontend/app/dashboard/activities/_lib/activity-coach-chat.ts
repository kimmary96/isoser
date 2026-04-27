import type { CoachMessage } from "@/lib/types";

type ActivityCoachChatPromptInput = {
  question: string;
  targetRole: string;
  activityTitle: string;
  activityType: string;
  recentMessages: CoachMessage[];
};

const CONTEXT_LINE_PATTERN = /^\s*(지원 직무|목표 직무|활동명|활동 유형|섹션 타입)\s*:/;

export function buildActivityCoachChatPrompt({
  question,
  targetRole,
  activityTitle,
  activityType,
  recentMessages,
}: ActivityCoachChatPromptInput): string {
  const trimmedQuestion = question.trim();
  const context = [
    targetRole.trim() ? `직무 참고: ${targetRole.trim()}` : "",
    activityTitle.trim() ? `활동 참고: ${activityTitle.trim()}` : "",
    activityType.trim() ? `유형 참고: ${activityType.trim()}` : "",
  ]
    .filter(Boolean)
    .join("\n");
  const history = recentMessages
    .slice(-4)
    .map((message) => `${message.role === "user" ? "사용자" : "코치"}: ${message.content}`)
    .join("\n");

  return `
너는 성과저장소의 AI 코치다.
사용자의 질문에만 답한다. STAR 진단, 전체 첨삭, 구조 진단은 하지 않는다.
내부 참고 정보는 답변 방향을 잡는 데만 사용하고, "지원 직무:", "활동명:", "활동 유형:" 같은 메타 라벨을 답변에 출력하지 않는다.
답변은 한국어로 작성하고, 긴 줄글 대신 아래 구조를 지킨다.

형식:
1. 핵심 답변: 1~2문장
2. 바로 할 일: 2~4개 bullet
3. 예시: 필요할 때만 1개

내부 참고 정보:
${context || "없음"}

최근 대화:
${history || "없음"}

사용자 질문:
${trimmedQuestion}
`.trim();
}

export function normalizeActivityCoachChatReply(reply: string): string {
  const normalized = reply
    .split(/\r?\n/)
    .filter((line) => !CONTEXT_LINE_PATTERN.test(line))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return normalized || "질문 기준으로 핵심만 다시 정리해볼게요.\n\n- 지금 가장 중요한 기준 1개를 먼저 고르세요.\n- 그 기준에 맞는 사례와 결과를 짧게 붙이면 됩니다.";
}

export function buildActivityCoachChatFallbackReply(question: string, targetRole: string): string {
  const normalizedQuestion = question.trim().toLowerCase();
  const role = targetRole.trim() || "지원 직무";

  if (!normalizedQuestion || /^(ㅇㅇ|응|네|ok|okay|음)$/i.test(normalizedQuestion)) {
    return [
      "1. 핵심 답변: 지금은 질문이 짧아서 구체 답변을 만들 근거가 부족합니다.",
      "",
      "2. 바로 할 일:",
      `- ${role} 관점에서 궁금한 기준을 한 문장으로 적어주세요.`,
      "- 예: 어떤 성과를 먼저 써야 해?",
      "- 예: 이 행동을 더 강하게 표현하려면 어떻게 써?",
    ].join("\n");
  }

  if (/시니어|senior|백엔드|backend/.test(normalizedQuestion)) {
    return [
      "1. 핵심 답변: 시니어 관점에서는 구현 목록보다 의사결정 기준과 운영 영향이 먼저 보여야 합니다.",
      "",
      "2. 바로 할 일:",
      "- 왜 그 기술을 선택했는지 대안과 함께 적으세요.",
      "- 장애, 처리량, 지연시간처럼 운영 지표를 연결하세요.",
      "- 본인이 설계하거나 판단한 범위를 분리해서 쓰세요.",
      "",
      "3. 예시: 단순 큐 대신 Redis Sorted Set을 선택한 이유를 우선순위 갱신, 만료 처리, 실시간 매칭 기준으로 설명하면 좋습니다.",
    ].join("\n");
  }

  if (/기준|우선|먼저|많/.test(normalizedQuestion)) {
    return [
      "1. 핵심 답변: 가장 큰 성과 1개를 먼저 고르고, 나머지는 그 성과를 만든 근거로 배치하면 됩니다.",
      "",
      "2. 바로 할 일:",
      "- 숫자로 증명되는 결과를 1순위로 고르세요.",
      "- 그 결과를 만든 핵심 행동 2개만 남기세요.",
      "- 기술명은 선택 이유가 있는 것만 강조하세요.",
    ].join("\n");
  }

  if (/문장|표현|어떻게 써|써야/.test(normalizedQuestion)) {
    return [
      "1. 핵심 답변: 문장은 문제, 선택, 행동, 결과 순서로 짧게 묶으면 좋습니다.",
      "",
      "2. 바로 할 일:",
      "- 첫 절에는 해결한 문제를 쓰세요.",
      "- 중간에는 내가 선택한 방식과 실행을 쓰세요.",
      "- 마지막에는 수치 결과를 붙이세요.",
      "",
      "3. 예시: 배달 매칭 지연 문제를 해결하기 위해 Redis 기반 우선순위 매칭을 설계하고, 매칭 시간을 12초에서 3초로 단축했습니다.",
    ].join("\n");
  }

  return [
    "1. 핵심 답변: 질문에서 말한 기준을 하나로 좁힌 뒤, 그 기준에 맞는 근거만 남기면 됩니다.",
    "",
    "2. 바로 할 일:",
    `- ${role}에서 중요하게 보는 역량을 하나 고르세요.`,
    "- 그 역량을 보여주는 행동과 결과를 연결하세요.",
    "- 관련 없는 설명은 줄이고 수치나 선택 근거를 남기세요.",
  ].join("\n");
}
