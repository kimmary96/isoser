# Career Evidence Engine v1

## 목적

이 문서는 성과저장소 AI 코치를 단일 채팅 기능이 아니라, 이소서 전체 문서 작성 흐름에서 재사용할 수 있는 `커리어 근거 재가공 엔진`으로 확장하기 위한 제품 기획과 개발 프레임워크를 정의한다.

핵심 목표는 사용자의 작은 활동, 프로젝트, 알바, 동아리, 학습 경험까지 지원 직무와 첨부 공고의 언어로 다시 해석해 이력서, 포트폴리오, 자기소개서, 성과 재생기에 재사용 가능한 근거로 만드는 것이다.

이 문서는 바로 전면 구현하지 않는다. 기존 동작을 보존하면서 작은 범위로 적용하고, 각 단계가 실제로 작동하는지 확인한 뒤 다음 단계로 넘어가는 것을 원칙으로 한다.

## 제품 방향

### 한 문장 정의

이소서의 AI는 글을 대신 써주는 도구가 아니라, 사용자의 성과를 직무 언어로 번역하고 검증 가능한 문장 후보로 바꿔주는 커리어 코치다.

### 사용자 가치

- 취준생과 주니어가 "별것 아닌 경험"이라고 생각하는 활동에서 직무 역량을 찾는다.
- 지원 직무를 입력하면 같은 성과도 직무에 맞는 단어와 강조점으로 바꾼다.
- 첨부 공고를 넣으면 공고 요구사항과 내 성과 근거가 어디서 맞고 어디가 부족한지 보여준다.
- 이력서, 포트폴리오, 자기소개서가 각각 따로 생성되는 것이 아니라 성과저장소를 원천 데이터로 공유한다.
- AI가 만든 문장을 그대로 믿게 하지 않고, 근거 부족과 사용자 확인 필요 항목을 명확히 표시한다.

### 적용 순서

1. 성과저장소 AI 코치
2. 이력서 공고 핏/패러프레이징
3. 포트폴리오 세로형 문서 생성/코칭
4. 성과 재생기

## 설계 원칙

### 작동 우선

- 기존 `/dashboard/activities/[id]` AI 코치 채팅은 제거하지 않는다.
- 새 기능은 기존 API/화면 위에 additive하게 붙인다.
- 각 단계는 독립적으로 배포 가능해야 한다.
- 한 단계에서 실패해도 기존 채팅, 활동 저장, STAR 저장, 포트폴리오 변환은 계속 작동해야 한다.

### 사실 보존

- 사용자가 입력하지 않은 수치, 기간, 역할, 성과를 AI가 확정 문장처럼 만들면 안 된다.
- 추론한 내용은 `검토 필요` 또는 `수치 보완 필요`로 표시한다.
- 공고 핏을 맞추더라도 실제 활동 근거가 없는 키워드는 "근거 부족"으로 분리한다.

### 공통 엔진, 화면별 출력

- 성과저장소, 이력서, 포트폴리오, 성과 재생기는 같은 커리어 근거 엔진을 사용한다.
- 화면마다 프롬프트를 새로 복붙하지 않고, 공통 진단/질문/rewrite/apply contract를 재사용한다.
- 다만 첫 구현은 기존 `coach_graph.py`를 한 번에 갈아엎지 않고, UI와 타입을 먼저 정리한다.

### RAG는 보조 근거

- ChromaDB는 사용자 원문 저장소가 아니라 공통 직무 지식과 문장 패턴 저장소다.
- 사용자 활동 원문은 Supabase `activities`와 문서 저장 테이블에 둔다.
- RAG 결과는 "이 직무에서 자주 쓰는 표현"과 "STAR 개선 예시"를 제공하는 보조 근거로만 쓴다.

## 대상 UX

### 성과저장소 AI 코치

성과 상세 화면의 AI 영역을 단순 채팅창에서 코칭 작업대로 확장한다.

사용자가 보는 핵심 영역:

| 영역 | 목적 |
| --- | --- |
| 진단 카드 | 문제 정의, 기술 선택, 구현 디테일, 정량 성과, 역할 명확화, 직무 연결성 상태 표시 |
| 살릴 포인트 | 현재 활동에서 지원 직무와 연결할 수 있는 강점 2-4개 |
| 부족한 질문 | 좋은 문장을 만들기 위해 사용자에게 물어볼 질문 2-3개 |
| 문장 후보 | 이력서용 1줄, 포트폴리오용 설명형, 면접 STAR형 후보 |
| 적용 액션 | 소개글에 적용, STAR에 적용, 기여내용에 추가 |
| 리스크 표시 | 수치 없음, 근거 부족, 과장 가능성, 사용자 확인 필요 |

### 이력서 공고 핏

이력서 빌더에서 지원 직무 또는 첨부 공고를 기준으로 성과 문장을 재작성한다.

흐름:

1. 사용자가 지원 직무를 입력한다.
2. 선택적으로 공고 텍스트를 붙여넣거나 첨부한다.
3. AI가 공고 요구역량과 키워드를 추출한다.
4. 사용자가 성과저장소 활동을 선택한다.
5. AI가 활동별로 공고 요구역량과 맞는 근거를 매핑한다.
6. 이력서 문장 후보를 만들고, 근거 부족 항목을 분리한다.
7. 사용자는 후보를 선택해 이력서 섹션에 반영한다.

### 포트폴리오 세로형 문서

포트폴리오는 이력서보다 맥락을 길게 보여준다. Notion형 세로 문서 경험을 기준으로 한다.

기본 섹션:

1. 한 줄 요약
2. 프로젝트/활동 배경
3. 해결한 문제
4. 내 역할
5. 실행 과정
6. 사용 기술/도구
7. 결과와 수치
8. 지원 직무와 연결되는 포인트
9. 회고와 다음 개선점

AI는 각 섹션 옆에서 부족한 근거, 과장 가능성, 공고 핏 보완점을 알려준다.

### 성과 재생기

성과 재생기는 작고 흐릿한 경험을 직무 언어로 되살리는 기능이다.

예상 UX:

- "이 경험을 어떤 직무에 쓸 수 있나요?"
- "이 경험에서 뽑을 수 있는 역량"
- "이력서에 쓰기엔 부족한 이유"
- "질문에 답하면 살릴 수 있는 포인트"
- "PM/개발/운영/마케팅 관점으로 다시 보기"

## 공통 엔진 프레임워크

### 내부 이름

`Career Evidence Engine`

사용자-facing 이름은 화면별로 다르게 둔다.

- 성과저장소: AI 코치
- 이력서: 공고 핏 코치
- 포트폴리오: 포트폴리오 코치
- 성과 재생기: 성과 재생기

### 입력 모델 초안

```ts
type CareerSurface = "activity" | "resume" | "portfolio" | "replay";

type CareerEvidenceInput = {
  surface: CareerSurface;
  targetRole?: string;
  jobPostingText?: string;
  activities: ActivityEvidence[];
  existingDocumentText?: string;
  userInstruction?: string;
};

type ActivityEvidence = {
  id?: string;
  type: "회사경력" | "프로젝트" | "대외활동" | "학생활동";
  title: string;
  organization?: string | null;
  period?: string | null;
  role?: string | null;
  skills?: string[];
  description?: string | null;
  contributions?: string[];
  starSituation?: string | null;
  starTask?: string | null;
  starAction?: string | null;
  starResult?: string | null;
};
```

### 출력 모델 초안

```ts
type CareerCoachingResult = {
  diagnosis: DiagnosisItem[];
  roleKeywords: KeywordSignal[];
  jobPostingSignals: JobPostingSignal[];
  evidenceMatches: EvidenceMatch[];
  questions: CoachingQuestion[];
  rewriteCandidates: RewriteCandidate[];
  applyActions: ApplyAction[];
  riskFlags: RiskFlag[];
};

type DiagnosisItem = {
  key:
    | "overview"
    | "problem_definition"
    | "tech_decision"
    | "implementation_detail"
    | "quantified_result"
    | "role_clarification"
    | "job_fit";
  status: "strong" | "partial" | "missing";
  label: string;
  reason: string;
};

type RewriteCandidate = {
  id: string;
  surface: "resume" | "portfolio" | "interview" | "activity_intro";
  text: string;
  focus:
    | "star_gap"
    | "quantification"
    | "verb_strength"
    | "job_fit"
    | "tech_decision"
    | "problem_definition";
  sourceActivityIds: string[];
  groundedKeywords: string[];
  needsUserCheck: boolean;
  riskNotes: string[];
};

type ApplyAction = {
  target: "activity.description" | "activity.star" | "resume.bullet" | "portfolio.section";
  label: string;
  payload: Record<string, unknown>;
};
```

첫 구현에서는 이 타입 전체를 API에 바로 노출하지 않는다. 기존 `CoachFeedbackResponse`의 `missing_elements`, `structure_diagnosis`, `rewrite_suggestions`를 UI에서 위 구조처럼 보이게 매핑한다.

## 백엔드 프레임워크

### 현재 재사용 대상

| 역할 | 현재 파일 |
| --- | --- |
| assistant 라우팅 | `backend/routers/assistant.py` |
| 코치 API | `backend/routers/coach.py` |
| LangGraph 흐름 | `backend/chains/coach_graph.py` |
| RAG 검색 | `backend/rag/retrievers.py` |
| Gemini 실패 fallback | `backend/rag/fallback.py` |
| 응답 스키마 | `backend/rag/schema.py` |
| 세션 저장 | `backend/repositories/coach_session_repo.py` |

### 목표 레이어

| 레이어 | 책임 | 적용 시점 |
| --- | --- | --- |
| Surface Adapter | activity/resume/portfolio/replay 입력을 공통 evidence input으로 변환 | 1단계 후반 |
| Evidence Diagnosis | 누락 요소, 직무 연결성, 근거 부족 판정 | 1단계 |
| Retrieval Context | 직무 패턴, STAR 예시, 공고 스니펫 검색 | 기존 유지 |
| Prompt Builder | 화면별 지시문 조립 | 1단계 후반 |
| Result Normalizer | LLM 응답을 공통 result로 정규화 | 1단계 후반 |
| Apply Planner | UI가 바로 반영할 수 있는 적용 액션 생성 | 1단계 후반 |

### 구현 방식

처음부터 큰 신규 엔진을 만들지 않는다.

1. 기존 `CoachResponse`를 UI에서 더 잘 활용한다.
2. 필요한 타입을 프론트 전용 mapper로 먼저 만든다.
3. UI 검증 후 백엔드에 공통 `CareerCoachingResult`를 추가한다.
4. 이력서/포트폴리오에서 같은 result를 재사용한다.

## 프론트엔드 프레임워크

### 성과저장소 1차 UI 구성

현재 `ActivityCoachPanel`은 채팅 중심이다. 1차 개선은 기존 채팅을 유지하고 오른쪽 또는 상단에 구조화 결과를 추가한다.

권장 컴포넌트:

| 컴포넌트 | 역할 |
| --- | --- |
| `ActivityCoachPanel` | 기존 채팅 컨테이너 유지 |
| `ActivityCoachInsightPanel` | 진단 카드, 살릴 포인트, 질문, 리스크 표시 |
| `RewriteCandidateList` | 문장 후보 목록 |
| `ApplySuggestionButton` | description/STAR draft에 반영 |
| `JobFitInput` | 지원 직무 입력과 직무 키워드 표시 |

### 적용 액션 원칙

- 처음에는 서버 저장까지 하지 않고 화면 draft에만 반영한다.
- 사용자가 확인 후 기존 저장 버튼을 눌러 저장한다.
- 이렇게 하면 AI 적용 실패가 DB 오염으로 이어지지 않는다.

### Phase 1 구현된 최소 contract

성과저장소 AI 코치 1차 구현은 아직 신규 백엔드 API나 DB 저장 구조를 만들지 않고, 기존 `CoachFeedbackResponse`를 프론트에서 구조화해 소비한다.

현재 구현된 프론트 contract:

```ts
type ActivityCoachInsight = {
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

type ActivityCoachRewriteCandidate = {
  id: string;
  text: string;
  focus: RewriteSuggestion["focus"];
  section: string;
  rationale: string;
  referencePattern: string | null;
  needsUserCheck: boolean;
  starTarget: "situation" | "task" | "action" | "result";
  starTargetLabel: "Situation" | "Task" | "Action" | "Result";
};
```

현재 적용 액션:

| 액션 | 대상 | 저장 여부 | 방어 규칙 |
| --- | --- | --- | --- |
| 소개글에 적용 | `descriptionDraft` | 자동 저장 없음 | 빈 문장은 무시 |
| STAR에 적용 | `starSituation` / `starTask` / `starAction` / `starResult` | 자동 저장 없음 | 기존 내용을 덮어쓰지 않고 중복 없이 append |
| 기여내용에 추가 | `contributions` | 자동 저장 없음 | 빈 칸 우선 사용, 최대 6개, 중복 방지 |

현재 코치 요청 context:

```ts
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
```

이 contract는 이력서/포트폴리오 단계로 확장할 때 아래 원칙을 그대로 가져간다.

- AI 후보는 바로 저장하지 않고 화면 draft에만 적용한다.
- 후보에는 어떤 근거에서 나왔는지와 사용자 확인 필요 여부를 붙인다.
- 공고/직무 키워드는 활동 근거와 분리해 표시한다.
- 없는 수치, 없는 역할, 없는 성과를 자동 확정하지 않는다.

## 단계별 개발 계획

### Phase 0. 문서와 현재 계약 고정

목표:

- 이 문서를 기준으로 개발 범위와 순서를 고정한다.
- 현재 코치 API 응답과 프론트 소비 지점을 확인한다.

작업:

- `docs/specs/career-evidence-engine-v1.md` 추가
- 현재 `/dashboard/activities/[id]` 코치 흐름 재확인
- 기존 테스트 목록 확인

완료 기준:

- 새 문서가 존재한다.
- 구현 시작 전 손댈 파일과 손대지 않을 파일이 명확하다.

검증:

- 문서 링크 확인
- `git status --short --branch`

### Phase 1A. 성과저장소 진단 카드 UI

목표:

- 백엔드 변경 없이 기존 `CoachFeedbackResponse`를 더 유용하게 보여준다.
- 채팅 응답 아래에 `missing_elements`, `structure_diagnosis`, `rewrite_suggestions`를 구조화해 표시한다.

예상 변경 파일:

- `frontend/app/dashboard/activities/_hooks/use-activity-detail.ts`
- `frontend/app/dashboard/activities/_components/activity-coach-panel.tsx`
- 신규 `frontend/app/dashboard/activities/_components/activity-coach-insight-panel.tsx`
- 필요 시 프론트 타입 mapper 파일

작게 자른 범위:

- 진단 카드 표시
- rewrite suggestion 표시
- 기존 채팅 유지
- DB 저장 없음
- 백엔드 변경 없음

테스트:

- 컴포넌트 렌더 테스트 또는 hook mapper 단위 테스트
- 기존 `npm run lint -- --file ...`
- 수동 확인: 코치 응답 후 기존 채팅과 진단 카드가 함께 보이는지

완료 기준:

- AI 응답 실패 시 기존 오류 문구가 유지된다.
- `rewrite_suggestions`가 없어도 UI가 깨지지 않는다.
- 기존 활동 저장/STAR 저장 동작이 변하지 않는다.

### Phase 1B. 문장 후보 draft 적용

목표:

- AI가 제안한 문장을 사용자가 활동 소개글 또는 STAR draft에 바로 넣을 수 있게 한다.

작게 자른 범위:

- `descriptionDraft`에 적용
- STAR 4필드 중 사용자가 선택한 필드에 적용
- 적용 후 자동 저장하지 않음

테스트:

- 버튼 클릭 시 draft state만 바뀌는지 확인
- 저장 버튼을 눌렀을 때 기존 `updateActivity` 흐름으로 저장되는지 확인

완료 기준:

- 사용자가 적용 후 되돌릴 수 있도록 기존 입력창에서 수정 가능하다.
- AI 문장 적용이 서버 저장을 자동 실행하지 않는다.

### Phase 1C. 지원 직무 기반 단어 변환

목표:

- `지원 직무` 입력값을 더 적극적으로 사용해 같은 활동을 직무별 표현으로 바꾼다.

작게 자른 범위:

- 기존 `job_title`을 프롬프트에 넘기는 흐름 유지
- 프론트에서는 직무 입력 후 "직무 언어로 다시 제안" 버튼 추가
- 백엔드 응답 계약은 기존 `CoachFeedbackResponse` 유지

테스트:

- PM, 백엔드 개발자 같은 입력에 따라 suggestion 표현이 달라지는지 fixture 기반 테스트 추가
- LLM 테스트는 monkeypatch로 구조만 검증

완료 기준:

- 직무 입력이 비어 있으면 기존 "일반" 동작 유지
- 직무 입력이 있어도 없는 사실이나 수치를 만들지 않는다.

### Phase 1D. 부족한 질문 생성

목표:

- 짧은 활동 설명에 대해 바로 rewrite만 하지 않고 보강 질문을 먼저 제공한다.

작게 자른 범위:

- 백엔드에 optional field 추가 또는 프론트 mapper에서 `missing_elements` 기반 질문 생성
- 초기에는 deterministic 질문 템플릿으로 시작한다.

예시:

| 누락 요소 | 질문 |
| --- | --- |
| 정량적 성과 | 결과를 숫자로 표현할 수 있는 지표가 있나요? |
| 역할 명확화 | 팀 규모와 본인이 맡은 범위는 어디까지였나요? |
| 기술 선택 근거 | 왜 그 기술이나 방식을 선택했나요? |
| 문제 정의 | 처음에 어떤 문제가 있었나요? |

테스트:

- 누락 요소별 질문 mapper 단위 테스트

완료 기준:

- LLM 호출 없이도 질문 표시가 가능하다.
- 질문 답변은 기존 채팅 입력으로 이어질 수 있다.

### Phase 2A. 이력서 공고 핏 분석 최소판

목표:

- 이력서 화면에서 공고 텍스트와 선택한 활동을 기준으로 fit gap을 보여준다.

작게 자른 범위:

- 공고 붙여넣기 textarea
- 선택한 활동 1-3개만 대상으로 분석
- 문장 후보는 생성하되 자동 반영하지 않음

예상 백엔드:

- 기존 `/assistant/message` 또는 새 BFF를 통해 coach flow 재사용
- 처음에는 별도 DB 테이블 추가 없음

테스트:

- 공고 텍스트가 없어도 기존 이력서 생성이 유지되는지
- 공고 텍스트가 있을 때 키워드/근거/부족분이 표시되는지

완료 기준:

- 공고 분석 실패 시 이력서 편집 화면 전체가 죽지 않는다.
- 사용자가 선택한 문장만 이력서에 반영된다.

### Phase 2B. 이력서 paraphrasing 적용

목표:

- 선택한 성과 문장을 공고/직무에 맞춰 이력서 bullet로 바꾼다.

작게 자른 범위:

- 이력서 bullet 후보 1-3개
- 근거 키워드와 리스크 표시
- 적용은 draft에만 반영

완료 기준:

- 공고 키워드가 활동 근거에 없으면 "근거 부족"으로 표시한다.
- 기존 PDF/export 흐름은 변경하지 않는다.

### Phase 3A. 포트폴리오 세로형 초안

목표:

- 성과 1개를 선택해 Notion형 세로 포트폴리오 초안을 만든다.

작게 자른 범위:

- 기존 `/activities/convert` 또는 포트폴리오 변환 로직 재사용
- 섹션 구조만 정리
- 저장 전 미리보기 중심

테스트:

- 활동 하나로 9개 기본 섹션이 생성되는지
- 이미지가 있는 활동은 기존 이미지 표시 흐름을 유지하는지

완료 기준:

- 포트폴리오 생성 실패 시 기존 포트폴리오 페이지 진입이 깨지지 않는다.
- 추론 항목에는 검토 필요 표시가 붙는다.

### Phase 3B. 포트폴리오 공고 핏 코칭

목표:

- 포트폴리오 섹션별로 공고와 맞는 부분/부족한 부분을 표시한다.

작게 자른 범위:

- 공고 텍스트 입력
- 섹션별 코멘트
- 섹션 순서 추천

완료 기준:

- 기존 저장된 포트폴리오를 읽는 흐름은 유지된다.
- 코칭 결과가 없어도 포트폴리오 문서 자체는 렌더된다.

### Phase 4A. 성과 재생기 최소판

목표:

- 작은 경험 하나를 여러 직무 관점으로 다시 해석한다.

작게 자른 범위:

- 활동 1개 입력 또는 선택
- 직무 1개 선택
- 살릴 수 있는 역량 3개
- 부족한 질문 3개
- 이력서용 짧은 후보 1개

완료 기준:

- "쓸 수 없음"이 아니라 "이렇게 보강하면 쓸 수 있음"으로 안내한다.
- 과장 가능성이 있는 표현은 검토 필요로 표시한다.

## DB 설계 방향

### 당장 변경하지 않을 것

- Phase 1A-1D에서는 새 테이블을 만들지 않는다.
- 기존 `activities`, `coach_sessions`를 유지한다.
- AI 적용 결과는 먼저 화면 draft에만 둔다.

### 나중에 검토할 저장 구조

필요성이 확인되면 아래 같은 저장 구조를 추가한다.

```sql
career_coaching_results
- id
- user_id
- surface
- source_activity_ids
- target_role
- job_posting_hash
- result_payload
- selected_candidate_id
- applied_targets
- created_at
- updated_at
```

저장 도입 조건:

- 사용자가 같은 코칭 결과를 다시 열어야 한다.
- 이력서/포트폴리오에서 같은 candidate를 재사용해야 한다.
- 적용 이력을 audit해야 한다.

## 프롬프트 설계 방향

### 한 프롬프트에 다 넣지 않는다

기능이 커질수록 아래 단계로 나눈다.

1. Evidence extraction: 입력 활동에서 사실 근거만 뽑기
2. Gap diagnosis: 누락 요소와 리스크 판단
3. Question generation: 필요한 보강 질문 생성
4. Rewrite generation: 화면 목적별 문장 후보 생성
5. Apply planning: 어느 필드에 적용 가능한지 제안

초기에는 기존 `coach_graph.py` 프롬프트를 유지하고, deterministic mapper와 UI로 먼저 체감 품질을 올린다.

### 금지 규칙

- 없는 수치 확정 금지
- 없는 직함/역할 확정 금지
- 공고 키워드를 활동 근거 없이 끼워 넣기 금지
- "합격 가능성" 같은 과도한 보장 표현 금지
- 사용자가 확인하지 않은 추론을 최종 문장으로 저장 금지

## 테스트 전략

### 단계별 게이트

각 phase는 아래 순서로 닫는다.

1. 타입/단위 테스트
2. 관련 lint 또는 backend pytest
3. 로컬 화면 수동 확인
4. 실패/빈 응답 fallback 확인
5. `git status --short --branch` 확인

### 핵심 회귀 테스트

| 영역 | 테스트 |
| --- | --- |
| 성과저장소 코치 | 기존 채팅 응답이 깨지지 않는지 |
| 진단 카드 | missing elements가 비어도 렌더되는지 |
| 적용 액션 | draft만 바뀌고 자동 저장하지 않는지 |
| 직무 입력 | 직무가 비어 있으면 기존 일반 코치가 동작하는지 |
| 공고 핏 | 공고 분석 실패 시 이력서 화면이 유지되는지 |
| 포트폴리오 | 코칭 결과 없이도 기존 포트폴리오 미리보기가 렌더되는지 |
| 성과 재생기 | 짧은 입력도 질문 중심으로 복구되는지 |

## 릴리즈 운영 원칙

- feature flag 또는 화면 내부 조건으로 새 UI를 점진 노출한다.
- 새 API가 실패하면 기존 채팅 응답만 보여준다.
- 새 DB 저장은 마지막에 도입한다.
- 사용자-facing 문구는 "AI가 완성"보다 "AI가 제안"을 사용한다.
- 각 phase 결과는 session report 또는 refactoring log에 짧게 남긴다.

## 첫 개발 티켓 후보

### Ticket 1. Activity coach insight mapper

목표:

- 기존 `CoachFeedbackResponse`를 진단 카드와 문장 후보 UI에 쓸 수 있는 프론트 모델로 변환한다.

범위:

- 프론트 mapper 함수 추가
- mapper 단위 테스트
- UI 연결은 아직 하지 않음

완료 기준:

- `missing_elements`, `structure_diagnosis`, `rewrite_suggestions`가 안정적으로 `ActivityCoachInsight`로 변환된다.

### Ticket 2. Activity coach insight panel

목표:

- 활동 상세 AI 코치 영역에 진단 카드와 문장 후보를 표시한다.

범위:

- 신규 컴포넌트 추가
- 기존 채팅 유지
- 백엔드 변경 없음

완료 기준:

- 코치 응답 후 진단 카드와 문장 후보가 보인다.
- 응답이 실패하거나 비어도 기존 채팅이 깨지지 않는다.

### Ticket 3. Apply suggestion to draft

목표:

- 문장 후보를 활동 소개글 draft에 반영한다.

범위:

- description draft 적용만 먼저 지원
- 자동 저장 없음

완료 기준:

- 적용 후 사용자가 기존 저장 버튼으로 저장한다.

### Ticket 4. Deterministic coaching questions

목표:

- 누락 요소별 보강 질문을 LLM 없이 표시한다.

범위:

- 질문 템플릿 mapper
- UI 표시

완료 기준:

- 짧은 활동에서도 사용자가 다음에 무엇을 답해야 하는지 알 수 있다.

## 셀프 리뷰

### 방향성 검토

이 방향은 현재 프로젝트 목표와 맞다. PRD는 이소서를 단순 AI 글쓰기 서비스가 아니라 활동 데이터를 기반으로 이력서, 자기소개서, 지원 문서를 빠르게 만들게 하는 서비스로 정의한다. 따라서 AI 코치를 단일 채팅이 아니라 성과저장소 기반 문서 생성 엔진으로 확장하는 것은 제품 방향과 일치한다.

### 개발 가능성 검토

작게 시작하면 개발 가능성이 높다. 특히 Phase 1A는 백엔드 변경 없이 기존 `CoachFeedbackResponse`를 UI에서 재구성하는 작업이라 리스크가 낮다. Phase 1B도 draft state에만 적용하면 DB 오염 위험이 낮다. 새 엔진과 DB 저장은 실제 사용성이 확인된 뒤 도입하는 것이 맞다.

### 리스크 검토

가장 큰 리스크는 범위 확장이다. 이력서, 포트폴리오, 성과 재생기를 한 번에 구현하면 실패 가능성이 높다. 따라서 첫 성공 기준은 "성과 하나를 진단하고, 질문하고, 문장 후보를 만들고, 사용자가 직접 적용한다"로 제한해야 한다.

두 번째 리스크는 AI 과장이다. 공고 핏을 맞추는 순간 없는 역량을 끼워 넣을 가능성이 생긴다. 이 문제는 `근거 있음`, `근거 약함`, `근거 없음`, `사용자 확인 필요`를 UI에 계속 표시해야 줄일 수 있다.

세 번째 리스크는 RAG 과신이다. DB가 방대해도 사용자 활동 입력이 부족하면 좋은 문장이 나오지 않는다. 그래서 rewrite보다 질문 생성과 근거 보강 UX가 먼저 필요하다.

### 최종 판단

이 개선안은 맞는 방향이다. 다만 "AI 엔진 대개편"으로 시작하면 위험하고, "기존 코치 응답을 구조화해 보여주는 UI 개선"으로 시작해야 한다. 첫 단계가 성공하면 같은 구조를 이력서, 포트폴리오, 성과 재생기에 순차 적용할 수 있다.
