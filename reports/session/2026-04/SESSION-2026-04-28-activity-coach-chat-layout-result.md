# SESSION-2026-04-28 Activity Coach Chat Layout Result

## Changed files
- `frontend/app/dashboard/activities/_lib/activity-coach-chat.ts`
- `frontend/app/dashboard/activities/_lib/activity-coach-chat.test.ts`
- `frontend/app/dashboard/activities/_lib/activity-coach-insight.ts`
- `frontend/app/dashboard/activities/_lib/activity-coach-insight.test.ts`
- `frontend/app/dashboard/activities/_lib/activity-evidence.ts`
- `frontend/app/dashboard/activities/_lib/activity-evidence.test.ts`
- `frontend/app/dashboard/activities/_lib/activity-intro-fallback.ts`
- `frontend/app/dashboard/activities/_lib/activity-intro-fallback.test.ts`
- `frontend/app/dashboard/activities/_lib/activity-star-import.ts`
- `frontend/app/dashboard/activities/_lib/activity-star-import.test.ts`
- `frontend/app/dashboard/activities/_components/activity-coach-panel.tsx`
- `frontend/app/dashboard/activities/_components/activity-coach-panel.test.tsx`
- `frontend/app/dashboard/activities/_components/activity-coach-insight-panel.tsx`
- `frontend/app/dashboard/activities/_components/activity-coach-insight-panel.test.tsx`
- `frontend/app/dashboard/activities/_components/activity-basic-tab.tsx`
- `frontend/app/dashboard/activities/_components/activity-basic-tab.test.tsx`
- `frontend/app/dashboard/activities/_components/activity-star-tab.tsx`
- `frontend/app/dashboard/activities/_components/activity-star-tab.test.tsx`
- `frontend/app/dashboard/activities/[id]/page.tsx`
- `frontend/app/dashboard/activities/_hooks/use-activity-detail.ts`
- `frontend/lib/api/app.ts`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made
- STAR 입력, AI 채팅, 진단 패널의 높이가 서로 달라 오른쪽 영역 정렬이 어색했다.
- 일반 질문을 보냈을 때 `/coach/feedback`의 구조화 activity context가 `지원 직무`, `활동명`, `활동 유형` 사용자 메시지처럼 노출됐다.
- 일반 질문도 STAR 진단처럼 긴 줄글로 답해 사용자의 질문 의도와 맞지 않았다.
- Gemini/API 실패 시 로컬 fallback이 고정 문구에 가까워 같은 답변이 반복됐다.
- 진단 패널의 `보강 질문`과 `문장 후보`가 같은 논리로 연결되지 않아, 기술 선택 근거 질문에 결과 중심 문장이 나오는 문제가 있었다.
- PDF 파싱 후 기본정보에 활동명, 역할, 기술, 기여내용이 채워져도 STAR 탭에서 다시 수동으로 옮겨야 했다.
- STAR 탭의 `AI 요약 생성`은 STAR를 이미 작성한 사용자만 쓸 수 있어, STAR 작성이 귀찮은 사용자의 소개글 생성 흐름에 맞지 않았다.
- 소개글 생성이 Gemini/API quota나 backend 오류로 실패하면 후보가 비어 사용자가 다시 수동 작성해야 했다.

## Preserved behaviors
- `코칭 진단` 버튼을 눌렀을 때만 구조화 진단 패널이 생성되는 흐름은 유지했다.
- STAR 4개 항목 완료 전 진단 버튼 비활성화와 오른쪽 placeholder 동작은 유지했다.
- 진단 결과의 소개글/STAR/기여내용 적용 버튼 동작은 유지했다.
- 백엔드가 내려주는 rewrite suggestion은 계속 사용할 수 있지만, 보강 질문과 같은 focus라면 질문 답변 예시를 우선한다.
- 기본정보 가져오기는 STAR draft만 수정하고 서버 저장은 기존 `저장` 버튼을 눌렀을 때만 수행한다.
- 기본정보 탭의 소개글 후보 생성도 후보를 선택해 draft에 반영하고, 실제 저장은 기존 `저장` 버튼을 눌렀을 때만 수행한다.
- 기존 `generateActivityIntro` API 성공 경로는 유지하고, 실패할 때만 로컬 fallback 후보를 사용한다.

## Result
- STAR 탭 grid는 `items-stretch`로 세 패널의 세로 길이를 같은 행 높이에 맞춘다.
- AI 채팅 패널과 진단 패널은 별도 `xl:h-[720px]` 고정 높이를 쓰지 않고 `h-full/min-h`로 STAR 패널 높이를 따라간다.
- 일반 채팅은 `/coach/feedback`이 아니라 채팅 전용 `/api/summary` prompt를 사용해 질문에만 답한다.
- 화면 응답에서 `지원 직무:`, `활동명:`, `활동 유형:` 같은 내부 메타 라벨은 제거된다.
- 채팅 답변은 `핵심 답변`, `바로 할 일`, 필요 시 `예시` 구조로 짧게 나오도록 제한했다.
- 채팅 호출 실패 시 질문 의도별 로컬 fallback을 사용해 `시니어/백엔드`, `기준/우선순위`, `문장/표현`, 짧은 긍정 응답을 서로 다르게 안내한다.
- 진단 패널 `문장 후보`에 내부 활동 컨텍스트가 섞여 들어오면 실제 개선 문장만 짧게 보여주고, `STAR 구조` 후보는 왼쪽 STAR 입력과 중복되어 숨긴다.
- 진단 패널 `문장 후보`는 `보강 질문`에 대한 답변 예시를 먼저 만들고, 활동명/직무/역할/기술/기여내용/STAR draft를 사용해 현재 성과와 맞는 후보를 구성한다.
- 예를 들어 `기술 선택 근거`가 부족하면 `왜 그 기술이나 방식을 선택했고...` 질문에 대해 Redis 등 실제 기술과 기여내용을 연결한 답변 예시를 우선 보여준다.
- STAR 기록 상단에 `기본정보 가져오기` 버튼을 추가했다.
- 버튼을 누르면 기본정보의 활동명, 유형, 조직, 기간, 팀 정보, 내 역할, 사용 기술, 기여내용, 소개글을 로컬 규칙으로 S/T/A/R 초안에 분배한다.
- 기존 STAR 내용은 덮어쓰지 않고 중복 없는 문단으로 뒤에 붙인다.
- 기여내용은 문제/목표 신호를 Task, 실행/구현 신호를 Action, 수치/성과 신호를 Result, 배경 신호를 Situation으로 분류한다.
- STAR 탭의 기존 `AI 요약 생성` 버튼은 제거했다.
- 기본정보 탭의 `간단 소개글 생성`은 새 활동뿐 아니라 기존 활동에서도 항상 표시된다.
- `간단 소개글 생성`은 STAR 작성 없이 기본정보와 기여내용을 기반으로 소개글 후보 1~3개를 만들고, 선택한 후보를 소개글 draft에 반영한다.
- `ActivityEvidenceSource` 공통 근거 타입을 추가해 STAR 가져오기, 소개글 생성 입력, 코치 진단 입력이 같은 활동 근거를 재사용한다.
- AI 소개글 생성 실패 시에는 기본정보와 기여내용을 이용한 로컬 소개글 후보를 대신 보여주고, fallback 안내 문구를 표시한다.

## Risks / possible regressions
- 일반 채팅은 summary endpoint를 쓰므로, 해당 endpoint의 Gemini quota나 env 설정에 영향을 받는다. 실패 시에는 짧은 로컬 fallback 답변을 표시한다.
- 일반 채팅은 구조 진단 결과를 만들지 않으므로, 사용자가 실제 진단을 원하면 별도 `코칭 진단` 버튼을 눌러야 한다.
- 문장 후보 예시는 사용자가 입력한 활동 context가 짧으면 일반화된 문장으로 생성될 수 있다. 이 경우 후보의 `확인 필요` 표시로 사용자가 사실관계를 보완해야 한다.
- 기본정보 가져오기는 키워드 기반 로컬 분류라서 기여내용 문장이 애매하면 Action으로 들어갈 수 있다. 사용자가 STAR 필드에서 최종 수정해야 한다.
- 기본정보 소개글 생성은 기존 `generateActivityIntro` API를 재사용하므로 provider quota나 백엔드 응답 품질의 영향을 받지만, 실패 시에는 로컬 fallback으로 최소 후보를 제공한다.
- 로컬 fallback 후보는 AI 문장만큼 정교하지 않으므로 사용자가 최종 문장을 다듬어야 한다.

## Follow-up refactoring candidates
- `/api/summary` 대신 활동 코치 전용 chat endpoint를 만들면 rate-limit, prompt, fallback을 더 명확히 분리할 수 있다.
- 채팅 답변 구조를 UI card로 렌더링하면 긴 텍스트보다 스캔하기 쉬워질 수 있다.
- `ActivityCoachInsightContext`를 별도 domain model로 분리하면 이력서/포트폴리오/성과 재생기에서도 같은 근거 패킷을 재사용하기 쉽다.
- 기본정보에서 STAR로 옮기는 분류 규칙을 향후 AI 코치 진단의 보강 질문과 연결하면 “가져오기 후 바로 진단” 흐름을 더 매끄럽게 만들 수 있다.

## Verification
- `npm --prefix frontend test -- app/dashboard/activities/_lib/activity-evidence.test.ts app/dashboard/activities/_lib/activity-intro-fallback.test.ts app/dashboard/activities/_lib/activity-star-import.test.ts app/dashboard/activities/_components/activity-basic-tab.test.tsx app/dashboard/activities/_components/activity-star-tab.test.tsx app/dashboard/activities/_lib/activity-coach-chat.test.ts app/dashboard/activities/_lib/activity-coach-insight.test.ts app/dashboard/activities/_components/activity-coach-insight-panel.test.tsx app/dashboard/activities/_components/activity-coach-panel.test.tsx`
- `npx tsc --noEmit` from `frontend/`
- `npm --prefix frontend run lint`
- `Invoke-WebRequest -UseBasicParsing http://localhost:3000/dashboard/activities/1eb23506-5e3e-4519-b714-b500055405bd -TimeoutSec 10` returned `200`
