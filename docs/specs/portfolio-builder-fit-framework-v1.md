# Portfolio Builder Fit Framework v1

## 목적

이 문서는 포트폴리오 화면을 이력서 빌더와 같은 맥락의 `성과 조합 + 공고 핏 + PDF 출력` 흐름으로 확장하기 위한 제품/개발 프레임워크다.

핵심 목표는 사용자가 성과저장소와 프로필에 이미 잘 정리해 둔 원천 데이터를 다시 크게 고치지 않고, 지원 공고에 맞게 프로젝트를 고르고, 순서를 정하고, 표현과 이미지 배치를 가볍게 다듬어 빠르게 포트폴리오 PDF를 만드는 것이다.

## 관련 문서

- `docs/specs/career-evidence-engine-v1.md`
- `docs/specs/포트폴리오 완성본 출력 스펙 — Codex 작업용.md`
- `docs/current-state.md`

## 제품 원칙

### 원천 데이터 우선

- 포트폴리오의 사실 근거는 `profiles`와 `activities`다.
- 성과저장소 STAR, 기여내용, 역할, 팀 구성, 기술, 이미지가 포트폴리오 출력의 원본이다.
- 포트폴리오 화면은 원본을 새로 쓰는 곳이 아니라, 조합과 포장을 하는 곳이다.
- AI가 없는 수치, 없는 역할, 없는 성과를 만들면 안 된다.

### 가벼운 AI 보조

포트폴리오 AI는 아래 범위 안에서만 동작한다.

- 공고와 선택 성과의 적합도 분석
- 성과가 많을 때 관련도 높은 프로젝트 3개 추천
- 프로젝트 표시 순서 추천
- 원문 근거 안에서의 패러프레이징 후보 제공
- 섹션별 보강 필요/검토 필요 표시
- 이미지 배치 위치와 캡션 초안 추천

아래는 하지 않는다.

- 성과저장소에 없는 경험을 새 프로젝트처럼 생성
- 없는 정량 지표를 확정값처럼 작성
- 원본 STAR를 자동 수정
- AI 후보를 사용자 확인 없이 저장
- 포트폴리오 생성 실패 때문에 기존 포트폴리오 미리보기 진입을 막기

### 이력서와 같은 사용자 모델

이력서의 `선택한 성과 + activity_line_overrides + PDF export`와 같은 구조를 포트폴리오에도 적용한다.

포트폴리오에서는 이를 다음 개념으로 확장한다.

- `selected_activity_ids`: 포함할 성과
- `project_order`: 출력 순서
- `section_overrides`: 포트폴리오 안에서만 쓰는 문장 보정
- `image_placements`: 이미지 배치 메타
- `fit_analysis`: 공고/직무 적합도 분석 결과
- `review_tags`: 수치 보완 필요, 검토 필요, 근거 부족 등

## 대상 사용자 플로우

### 기본 흐름

1. 사용자는 성과저장소에서 STAR와 활동 정보를 충분히 작성한다.
2. 포트폴리오 화면에 진입한다.
3. 지원 직무와 공고 텍스트 또는 URL 추출 내용을 입력한다.
4. 성과가 많으면 AI가 공고 관련도 높은 프로젝트 3개를 추천한다.
5. 사용자는 추천 프로젝트를 그대로 쓰거나 직접 성과를 추가/제외한다.
6. AI가 프로젝트 순서, 섹션별 공고 핏, 이미지 배치를 제안한다.
7. 사용자는 필요한 패러프레이징 후보만 포트폴리오 draft에 적용한다.
8. 포트폴리오 문서를 저장한다.
9. 저장된 문서를 PDF로 다운로드한다.

### 성과가 적은 경우

- 성과가 1-3개면 전체 후보를 보여주고, 추천은 선택 보조로만 표시한다.
- 프로젝트를 강제로 3개로 맞추지 않는다.
- 부족한 성과는 성과저장소 보강 안내로 연결한다.

### 성과가 많은 경우

- 기본 추천 개수는 3개다.
- 사용자가 원하면 1개, 2개, 4개 이상도 선택할 수 있다.
- 추천 결과에는 점수만 보여주지 않고, 왜 추천됐는지 근거를 보여준다.

예시:

```text
추천 1. 실시간 배달 매칭 플랫폼
- 공고 키워드: FastAPI, Redis, 실시간 처리
- 성과 근거: WebSocket, 주문 상태 동기화, 매칭 시간 단축
- 보강 필요: 운영 규모 수치 확인
```

## 출력 구조

기본 출력은 `포트폴리오 완성본 출력 스펙`의 6단계 구조를 따른다.

1. 프로젝트 개요
2. 문제 정의
3. 기술적 의사결정
4. 구현
5. 성과
6. 트러블슈팅 또는 회고

화면에서는 세로형 문서 경험을 우선한다.

- 프로젝트별 섹션을 카드처럼 분리하지 않고 문서 흐름으로 이어서 보여준다.
- 이미지는 프로젝트 개요, 구현, 성과 섹션 사이에 배치할 수 있다.
- PDF는 같은 payload를 기반으로 렌더링한다.

## 데이터 모델 초안

### PortfolioDocumentPayload

```ts
type PortfolioDocumentPayload = {
  version: 2;
  title: string;
  targetJob: string | null;
  jobPostingSummary?: string | null;
  profileSnapshot: PortfolioProfileSnapshot;
  selectedActivityIds: string[];
  projectOrder: string[];
  projects: PortfolioProjectDraft[];
  fitAnalysis?: PortfolioFitAnalysis | null;
  imagePlacements: PortfolioImagePlacement[];
  templateId: string;
  createdFrom: "portfolio-builder";
};
```

### PortfolioProjectDraft

```ts
type PortfolioProjectDraft = {
  activityId: string;
  sourceActivity: ActivityEvidenceSnapshot;
  generatedSections: PortfolioSections;
  sectionOverrides: Partial<PortfolioSections>;
  reviewTags: PortfolioReviewTag[];
  fitScore?: number;
  fitReasons?: string[];
  gapNotes?: string[];
};
```

### PortfolioSections

```ts
type PortfolioSections = {
  overview: {
    title: string;
    oneLineSummary: string;
    period: string | null;
    team: string | null;
    role: string | null;
    skills: string[];
    contributions: string[];
  };
  problemDefinition: string;
  techDecision: string;
  implementation: {
    summary: string;
    highlights: string[];
  };
  result: {
    summary: string;
    metrics: Array<{ value: string; label: string }>;
  };
  troubleshooting?: string | null;
  jobFitSummary?: string | null;
};
```

### PortfolioImagePlacement

```ts
type PortfolioImagePlacement = {
  id: string;
  activityId: string;
  imageUrl: string;
  sectionKey:
    | "overview"
    | "problemDefinition"
    | "techDecision"
    | "implementation"
    | "result"
    | "troubleshooting";
  order: number;
  captionDraft?: string | null;
  source: "activity.image_urls";
  needsUserCheck?: boolean;
};
```

### PortfolioFitAnalysis

```ts
type PortfolioFitAnalysis = {
  targetJob: string | null;
  analyzedAt: string;
  recommendedActivityIds: string[];
  activities: Array<{
    activityId: string;
    score: number;
    rank: number;
    matchedJobKeywords: string[];
    matchedEvidenceKeywords: string[];
    strongReasons: string[];
    gapReasons: string[];
    riskFlags: PortfolioReviewTag[];
  }>;
};
```

### PortfolioReviewTag

```ts
type PortfolioReviewTag =
  | "수치 보완 필요"
  | "검토 필요"
  | "본인 경험으로 수정 필요"
  | "근거 부족"
  | "이미지 캡션 확인 필요";
```

## 공고 적합도 분석 프레임워크

### 입력

- 지원 직무
- 공고 텍스트, URL 추출 결과, 이미지/PDF 추출 결과 중 하나 이상
- 사용자 프로필
- 전체 또는 선택된 성과 목록
- 각 성과의 STAR, 기여내용, 기술, 역할, 팀 구성, 이미지 여부

### 1차 점수는 deterministic으로 계산

LLM 호출 전에 로컬 규칙으로 후보를 좁힌다.

권장 가중치:

| 항목 | 가중치 | 설명 |
| --- | ---: | --- |
| 기술/도구 키워드 매칭 | 25 | 공고 기술과 activity.skills/contributions/STAR의 직접 일치 |
| 역할/직무 언어 매칭 | 20 | 공고 역할과 my_role/role/description의 일치 |
| 문제-구현-성과 완성도 | 20 | STAR와 포트폴리오 6단계 필수 섹션 충실도 |
| 정량 성과 근거 | 15 | 숫자, %, 건수, 시간, 비용 등 검증 가능한 지표 |
| 프로젝트 설명 밀도 | 10 | description/contributions가 충분한지 |
| 이미지/시각 자료 유무 | 5 | 포트폴리오에서 보여줄 증빙 이미지 존재 |
| 최신성/대표성 | 5 | 기간과 활동 유형 기반 보조 점수 |

총점은 100점 기준이다.

### 2차 AI 분석은 설명과 순서 추천에 사용

AI는 점수를 확정하지 않고, 아래 설명을 보강한다.

- 왜 이 프로젝트가 공고에 맞는지
- 어떤 섹션을 앞에 두면 좋은지
- 어떤 프로젝트는 제외해도 되는지
- 공고에는 있지만 성과 근거가 약한 부분
- 사용자 확인이 필요한 표현

### 추천 3개 선정 규칙

1. deterministic score 상위 후보 5개를 만든다.
2. 같은 활동 유형/같은 기술만 반복되면 다양성 보정을 적용한다.
3. AI가 상위 후보의 설명과 순서를 제안한다.
4. 최종 기본 선택은 상위 3개로 둔다.
5. 사용자가 수동으로 추가/제외할 수 있다.

동점 처리:

- 정량 성과가 있는 프로젝트 우선
- 공고 핵심 기술과 직접 매칭되는 프로젝트 우선
- 이미지가 있는 프로젝트 우선
- 최근 프로젝트 우선

## AI 보조 기능 범위

### 1. 프로젝트 추천

입력:

- 전체 activities
- targetJob
- jobPostingText

출력:

- recommendedActivityIds
- rank
- score
- fit reasons
- gap reasons
- risk flags

### 2. 프로젝트 순서 추천

권장 순서:

1. 공고 핵심 요구와 가장 직접 맞는 프로젝트
2. 역할과 문제 해결력이 잘 드러나는 프로젝트
3. 보조 강점 또는 차별점이 있는 프로젝트

AI가 순서를 바꿔도 사용자가 drag/drop 또는 위/아래 이동으로 수정할 수 있어야 한다.

### 3. 패러프레이징

패러프레이징은 원천 근거 안에서만 허용한다.

대상:

- 프로젝트 한 줄 요약
- 문제 정의 첫 문장
- 기술적 의사결정 요약
- 구현 summary
- 성과 summary
- 지원 직무와 연결되는 포인트

저장 방식:

- 원본 활동은 수정하지 않는다.
- 포트폴리오 문서의 `sectionOverrides`에만 저장한다.
- 적용 전/후를 되돌릴 수 있어야 한다.

### 4. 이미지 배치

AI는 이미지를 생성하거나 수정하지 않는다.

대상:

- `activity.image_urls`

추천 항목:

- 어느 프로젝트에 배치할지
- 어느 섹션 뒤에 배치할지
- 이미지 순서
- 캡션 초안

캡션은 추론 가능성이 있으므로 기본적으로 `이미지 캡션 확인 필요`를 붙인다.

## 프론트엔드 구조 계획

### 주요 화면

`/dashboard/portfolio`

- 성과 선택 패널
- 공고/직무 입력 패널
- 추천 프로젝트 3개 패널
- 포트폴리오 세로형 미리보기
- 이미지 배치 편집
- AI 보조 패널
- 저장 버튼

`/dashboard/portfolio/export?portfolioId=...`

- 저장된 포트폴리오 payload 로드
- PDF 미리보기
- `@react-pdf/renderer` 기반 다운로드

### 권장 파일 구조

```text
frontend/app/dashboard/portfolio/page.tsx
frontend/app/dashboard/portfolio/_hooks/use-portfolio-builder.ts
frontend/app/dashboard/portfolio/_components/portfolio-activity-selector.tsx
frontend/app/dashboard/portfolio/_components/portfolio-fit-panel.tsx
frontend/app/dashboard/portfolio/_components/portfolio-preview-pane.tsx
frontend/app/dashboard/portfolio/_components/portfolio-image-placement-editor.tsx
frontend/app/dashboard/portfolio/_components/portfolio-assistant-panel.tsx
frontend/app/dashboard/portfolio/_lib/portfolio-document.ts
frontend/app/dashboard/portfolio/_lib/portfolio-fit.ts
frontend/app/dashboard/portfolio/export/page.tsx
frontend/app/dashboard/portfolio/export/_components/portfolio-pdf-download.tsx
frontend/app/dashboard/portfolio/export/_hooks/use-portfolio-export.ts
frontend/app/api/dashboard/portfolio-export/route.ts
```

## API/BFF 계획

### 기존 유지

- `GET /api/dashboard/portfolios`
- `POST /api/dashboard/portfolios`
- backend `POST /activities/convert`

### 확장

`POST /api/dashboard/portfolios`

- 기존 단일 portfolio payload 저장을 계속 허용한다.
- 새 `PortfolioDocumentPayload` 저장도 허용한다.
- `selected_activity_ids`는 여러 활동 id를 저장한다.
- `source_activity_id`는 대표 activity id 또는 첫 번째 activity id로 저장한다.

`GET /api/dashboard/portfolio-export?portfolioId=...`

- 인증 사용자 기준 portfolio row 조회
- payload v1/v2 정규화
- 선택 activity와 profile snapshot fallback 제공

`POST /api/dashboard/portfolio/fit`

초기에는 BFF 내부 deterministic 분석만으로 시작한다.

요청:

```ts
type PortfolioFitRequest = {
  targetJob?: string | null;
  jobPostingText?: string | null;
  activityIds?: string[];
  recommendLimit?: number;
};
```

응답:

```ts
type PortfolioFitResponse = {
  recommendedActivityIds: string[];
  analysis: PortfolioFitAnalysis;
};
```

후속으로 AI 설명 보강이 필요해지면 기존 coach/rewrite 계열 flow를 얇게 감싼다.

## 구현 단계

### Phase 0. 현재 계약 고정

목표:

- 현재 포트폴리오 단일 활동 생성/저장/미리보기 흐름을 보존한다.

작업:

- v1 portfolio payload 정규화 helper 작성
- v2 document payload 타입 추가
- legacy saved portfolio fixture 기반 단위 테스트 추가

완료 기준:

- 기존 저장 초안이 계속 열린다.
- 단일 활동 세션스토리지 진입 흐름이 깨지지 않는다.

### Phase 1. 조합형 포트폴리오 draft

목표:

- 여러 성과를 선택해 하나의 포트폴리오 draft를 만든다.

작업:

- 성과 선택 UI 추가
- 선택한 성과를 `/activities/convert`로 변환
- `PortfolioDocumentPayload`로 조합
- 프로젝트 순서 수동 변경
- 저장 API 확장

완료 기준:

- 성과 2개 이상 선택 후 저장/재진입이 된다.
- 기존 단일 활동 포트폴리오 저장 흐름을 유지한다.

### Phase 2. 공고 적합도 분석과 추천 3개

목표:

- 공고 기준으로 포트폴리오에 넣기 좋은 프로젝트 3개를 추천한다.

작업:

- 공고/직무 입력 UI 추가
- deterministic fit score helper 추가
- 추천 3개 패널 추가
- 추천 이유/부족 이유/근거 키워드 표시
- 사용자가 추천 적용 또는 수동 변경 가능

완료 기준:

- 성과가 4개 이상이면 관련도 높은 3개를 기본 추천한다.
- 공고 텍스트가 없어도 직접 선택으로 포트폴리오 생성이 된다.
- 추천 실패 시 기존 조합 흐름이 유지된다.

### Phase 3. 가벼운 패러프레이징과 순서 추천

목표:

- 원천 근거를 유지한 채 공고에 맞는 표현 후보와 순서 제안을 제공한다.

작업:

- 선택 프로젝트 순서 추천
- 섹션별 패러프레이징 후보 1-3개
- 후보 적용/해제
- `sectionOverrides` 저장
- 근거 부족/검토 필요 태그 표시

완료 기준:

- AI 후보는 자동 저장되지 않는다.
- 적용 후보는 포트폴리오 draft에만 반영된다.
- 원본 activity는 변경되지 않는다.

### Phase 4. 이미지 배치

목표:

- 성과저장소 이미지가 포트폴리오 문서 흐름 안에 자연스럽게 배치된다.

작업:

- activity image list 수집
- 섹션별 이미지 placement 편집
- AI placement 추천
- caption draft와 확인 필요 태그
- PDF 렌더링 반영

완료 기준:

- 이미지가 없는 활동은 기존 텍스트 문서로 정상 출력된다.
- 이미지가 있는 활동은 섹션 사이에 배치된다.
- PDF에서도 배치 순서가 유지된다.

### Phase 5. React PDF export

목표:

- 브라우저 print 대신 이력서와 같은 명시적 PDF 다운로드 흐름을 제공한다.

작업:

- portfolio export BFF 추가
- export page 추가
- `PortfolioPdfDownload` 추가
- Pretendard local font 재사용
- 파일명 sanitize/download helper 재사용 또는 분리

완료 기준:

- 저장된 portfolio id로 export page가 열린다.
- PDF 생성 중/오류 상태가 표시된다.
- 텍스트, review tag, 이미지가 PDF에 반영된다.

## 테스트 전략

### 단위 테스트

- legacy portfolio payload 정규화
- v2 portfolio payload 정규화
- fit score 계산
- 추천 3개 선정
- 동점 처리
- section override 적용/해제
- image placement 정렬
- review tag mapping

### 화면/통합 테스트

- 성과 1개 선택
- 성과 3개 선택
- 성과 5개 이상에서 추천 3개 적용
- 공고 텍스트 없음
- 공고 텍스트 있음
- 이미지 없는 활동
- 이미지 1개 이상 있는 활동
- 저장 후 재진입
- export page 진입

### 회귀 테스트

- 기존 `/dashboard/portfolio` 단일 변환 preview 유지
- 기존 `portfolios.portfolio_payload` 저장 초안 열기
- 기존 `/activities/convert` 응답 계약 유지
- 성과저장소 activity 저장/STAR 저장 흐름 불변
- 이력서 builder/export 흐름 불변

## 리스크와 방어

### 원본과 출력 override 불일치

방어:

- 원본 activity는 수정하지 않는다.
- override는 portfolio payload 안에만 저장한다.
- 화면에서 원문 기반임을 구분할 수 있게 한다.

### AI 과장

방어:

- 없는 수치 생성 금지
- 근거 없는 키워드는 `근거 부족` 표시
- 추론 캡션과 문장은 `검토 필요` 표시
- 적용 전 사용자 선택 필수

### 성능

방어:

- 전체 활동을 LLM에 바로 보내지 않는다.
- deterministic score로 상위 후보를 먼저 좁힌다.
- AI 설명 보강은 선택된 후보 중심으로 제한한다.

### PDF 이미지 로딩

방어:

- 이미지 로딩 실패 시 텍스트 문서 출력은 계속 진행한다.
- 이미지 렌더 오류를 다운로드 실패 전체로 확대하지 않는 fallback을 둔다.

## 추가 리팩토링 후보

- 이력서/포트폴리오 PDF 다운로드 공통 유틸 분리
- `ActivityCoachInsight`를 바로 공통 엔진으로 키우기 전에 portfolio adapter를 얇게 추가
- `portfolio/page.tsx`를 hook, selector, preview, assistant, saved list로 분리
- `activity_to_portfolio()`의 6단계 변환 결과와 프론트 v2 payload mapper를 분리
- image placement editor를 활동 상세 이미지 순서 기능과 나중에 연결

## 첫 구현 티켓 후보

### Ticket 1. Portfolio document normalizer

목표:

- v1 단일 portfolio payload와 v2 document payload를 하나의 렌더 입력으로 정규화한다.

완료 기준:

- 기존 저장 초안이 깨지지 않는다.
- v2 payload fixture가 `projects[]`로 안정화된다.

### Ticket 2. Portfolio fit scorer

목표:

- 공고/직무와 activities를 비교해 추천 3개 후보를 계산한다.

완료 기준:

- 활동 5개 입력 시 상위 3개와 추천 이유가 반환된다.
- 공고 텍스트가 없어도 STAR 완성도 기준 fallback ranking이 동작한다.

### Ticket 3. Multi-project portfolio builder

목표:

- 여러 성과를 선택해 하나의 포트폴리오 draft를 저장한다.

완료 기준:

- 선택/순서/저장/재진입이 된다.
- 기존 단일 활동 생성 버튼은 유지된다.

### Ticket 4. Portfolio PDF export

목표:

- 저장된 포트폴리오를 react-pdf 기반 PDF로 다운로드한다.

완료 기준:

- 텍스트 중심 PDF가 먼저 안정적으로 생성된다.
- 이미지가 있으면 section placement 기준으로 렌더된다.

