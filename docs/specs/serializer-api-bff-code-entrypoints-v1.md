# Serializer API BFF Code Entrypoints v1

기준일: 2026-04-24  
상태: proposed  
범위: `program-surface-contract-v2` 전환을 위한 실제 코드 진입점 정리

## 1. 문서 목적

이 문서는 “어디부터 바꿔야 하는가”를 추상 순서가 아니라 현재 저장소의 실제 파일과 함수 기준으로 고정하는 문서다.

이미 있는 `serializer-api-bff-transition-plan-v1.md`가 전환 원칙과 큰 순서를 정리했다면, 이 문서는 그 순서를 실제 코드에 꽂아 넣는 작업 지도다.

## 2. 이번 턴에서 실제로 확인한 현재 상태

### backend

- `backend/routers/programs.py` 한 파일에 목록 요약, 추천 요약, 캘린더 추천, 상세 응답 serializer가 함께 들어 있다.
- `ProgramListItem`이 카드형/테이블형/추천형 요약을 모두 겸하고 있다.
- 목록 경로와 추천 경로가 모두 `ProgramListItem.model_validate(...)`를 공용으로 쓴다.
- 상세는 별도 `ProgramDetailResponse`가 있고, 최근 단건/배치 상세는 `programs + program_source_records` 조합을 읽기 시작했다. 다만 목록/추천과 공유되는 base summary 계층 공용화와 compare consumer cleanup은 아직 남아 있다.

### frontend shared types/helper

- `frontend/lib/types/index.ts`의 `Program`이 목록/추천/북마크/캘린더 fallback/BFF 임시 필드를 모두 품고 있다.
- `frontend/lib/api/backend.ts`도 `listPrograms`, `getProgram`, `getPrograms`가 모두 이 monolith `Program`을 반환한다.

### frontend BFF

- `frontend/app/api/dashboard/recommended-programs/route.ts`는 backend 추천 응답의 `item.program`을 그대로 복사한 뒤 `_reason`, `_fit_keywords`, `_score`, `_relevance_score`를 덧붙인다.
- `frontend/app/api/dashboard/recommend-calendar/route.ts`는 fallback 응답을 만들 때 `program: Program` 구조를 그대로 유지한다.
- `frontend/app/api/dashboard/bookmarks/route.ts`와 `frontend/app/api/dashboard/calendar-selections/route.ts`는 이제 `program_list_index` summary read를 우선 사용하고, read model 미적용/누락 row만 `programs`로 fallback한다.
- `frontend/app/api/programs/compare-relevance/route.ts`는 얇은 proxy지만, 이후 새 summary/context 타입이 들어오면 같이 맞춰야 한다.

## 3. backend 실제 진입점

| 파일 | 실제 심볼 | 현재 역할 | 남은 문제 | 1차 조치 |
| --- | --- | --- | --- | --- |
| `backend/routers/programs.py` | `ProgramListItem` | 목록/추천 공용 요약 타입 | 카드형과 테이블형 문맥이 섞여 있음 | `ProgramCardSummary`, `ProgramListRow` 분리 전까지 내부 serializer 진입점으로만 축소 |
| `backend/routers/programs.py` | `ProgramRecommendItem`, `CalendarRecommendItem` | 추천 응답 wrapper | 추천 context와 프로그램 summary가 강하게 결합됨 | `program + context` 구조로 단계적 이행 |
| `backend/routers/programs.py` | `ProgramListPageResponse` | `/programs/list` 응답 wrapper | `items`와 `promoted_items`가 모두 `ProgramListItem` | 카드형/테이블형 전용 item 분리 필요 |
| `backend/routers/programs.py` | `ProgramDetailResponse` | 상세 응답 타입 | 상세만 따로 있고 summary 계층 공용화가 안 됨 | `summary + detail (+ context)` 방향으로 재배치 |
| `backend/routers/programs.py` | `_serialize_program_list_row()` | raw row -> 현재 목록 요약 dict | 사실상 공용 serializer 허브 | 가장 먼저 base/card/list serializer 뿌리로 쪼갤 지점 |
| `backend/routers/programs.py` | `_serialize_program_recommendation()` | RAG 추천 -> 추천 응답 | 내부에서 `ProgramListItem` 재사용 | 추천 context builder와 summary serializer 분리 필요 |
| `backend/routers/programs.py` | `_build_program_detail_response()` | raw row -> 상세 응답 | 상세만 독립 구현 | canonical detail serializer의 직접 후보 |
| `backend/routers/programs.py` | `list_programs()` | legacy/기본 목록 GET | 오래된 plain list 경로 | 새 row serializer 준비 전까지 유지, 이후 축소 후보 |
| `backend/routers/programs.py` | `list_programs_page()` | read-model 목록 페이지 응답 | `ProgramListItem.model_validate(row)` 직접 사용 | `ProgramListRowItem` 전환의 첫 backend endpoint |
| `backend/routers/programs.py` | `get_programs_batch()` | 비교/선택 모달용 기본 목록 batch | 이제 `program_list_index` summary read 우선 + `programs` fallback, 하지만 응답은 아직 `ProgramListItem` monolith | compare summary 전용 타입/consumer cleanup |
| `backend/routers/programs.py` | `get_program_details_batch()`, `get_program_detail()` | 상세 batch / 단건 상세 | `programs + program_source_records` 조합 이식이 시작됨 | consumer와 남은 legacy helper cleanup |
| `backend/routers/programs.py` | `recommend_programs()` | 추천 카드 backend | 추천 item에 현재 summary를 직접 포함 | `ProgramCardSummary + ProgramSurfaceContext` 방향으로 전환 |
| `backend/routers/programs.py` | `recommend_programs_calendar()` | 캘린더 추천 backend | 추천 카드와 유사한 중복 wrapper | 카드형 summary 공유 후 캘린더 전용 context만 유지 |

## 4. frontend shared type / helper 실제 진입점

| 파일 | 실제 심볼 | 현재 역할 | 남은 문제 | 1차 조치 |
| --- | --- | --- | --- | --- |
| `frontend/lib/types/index.ts` | `Program` | 거의 모든 화면의 공용 프로그램 타입 | 카드/목록/상세/추천/BFF 임시 필드가 뒤섞임 | 새 타입 추가 후 신규 화면부터 의존 끊기 |
| `frontend/lib/types/index.ts` | `ProgramDetail` | 상세 응답 타입 | backend `ProgramDetailResponse`와 이름/구조 drift 가능성 | backend 계약과 동기화 필요 |
| `frontend/lib/types/index.ts` | `ProgramListPageResponse` | 목록 페이지 응답 | `items`, `promoted_items`가 둘 다 `Program[]` | `ProgramListRowItem[]` 방향으로 변경 필요 |
| `frontend/lib/types/index.ts` | `ProgramRecommendItem`, `CalendarRecommendItem` | 추천 wrapper | 내부 `program: Program` 구조 유지 | `program + context` 구조로 정리 필요 |
| `frontend/lib/api/backend.ts` | `listPrograms()` | plain list helper | `Program[]` 반환 | legacy helper로 축소하거나 row helper로 교체 |
| `frontend/lib/api/backend.ts` | `listProgramsPage()` | 메인 목록 helper | 목록이 아직 monolith 타입 | `ProgramListRowItem` 전환 첫 helper |
| `frontend/lib/api/backend.ts` | `getProgram()`, `getPrograms()` | 기본 program fetch helper | 상세/비교/북마크에서 monolith 확산 | base summary 또는 compare summary helper로 축소 필요 |
| `frontend/lib/api/backend.ts` | `getProgramDetail()`, `getProgramDetails()` | 상세 helper | 타입명은 있지만 summary 계층과 연결이 약함 | detail 계약 전환 시 유지하되 payload shape만 교체 |

## 5. frontend BFF 실제 진입점

| 파일 | 현재 역할 | 실제 확인한 문제 | 전환 우선순위 |
| --- | --- | --- | --- |
| `frontend/app/api/dashboard/recommended-programs/route.ts` | 대시보드 추천 카드 BFF | `item.program`에 `_reason`, `_fit_keywords`, `_score`, `_relevance_score`를 직접 붙임 | 1순위 |
| `frontend/app/api/dashboard/recommend-calendar/route.ts` | 캘린더 추천 + fallback BFF | fallback도 `program: Program` 그대로 사용 | 1순위 |
| `frontend/app/api/dashboard/bookmarks/route.ts` | 찜한 프로그램 조회 | `program_list_index` summary read 우선, `programs` fallback 유지 | 완료 |
| `frontend/app/api/dashboard/calendar-selections/route.ts` | 캘린더 적용 프로그램 조회/저장 | 조회 시 `program_list_index` summary read 우선, `programs` fallback 유지 | 완료 |
| `frontend/app/api/programs/compare-relevance/route.ts` | 비교 관련도 proxy | 응답 자체는 얇지만 새 summary/context 구조 영향 받음 | 3순위 |

## 6. 실제 전환 순서

### 6.1 1단계: backend 내부 serializer 분리

가장 먼저 손대야 하는 곳:

- `backend/routers/programs.py::_serialize_program_list_row()`
- `backend/routers/programs.py::_serialize_program_recommendation()`
- `backend/routers/programs.py::_build_program_detail_response()`

이 단계에서 해야 할 일:

- `ProgramBaseSummary`
- `ProgramCardSummary`
- `ProgramListRow`
- `ProgramSurfaceContext`

이 네 층으로 내부 serializer를 나눈다.

중요:

- endpoint 응답 모양은 바로 안 바꿔도 된다.
- 먼저 내부 구현만 “raw row 직접 해석”에서 “serializer 호출”로 바꿔야 한다.

### 6.2 2단계: frontend 타입 병행 추가

가장 먼저 손대야 하는 곳:

- `frontend/lib/types/index.ts`

이 단계에서 해야 할 일:

- 기존 `Program`은 당장 지우지 않는다.
- 대신 아래 타입을 새로 추가한다.
  - `ProgramCardSummary`
  - `ProgramListRow`
  - `ProgramDetailResponse`
  - `ProgramSurfaceContext`
  - 필요하면 `ProgramCardItem`, `ProgramListRowItem`

목표는 “새 코드가 더 이상 `Program` monolith를 새로 퍼뜨리지 않게 막는 것”이다.

### 6.3 3단계: drift가 큰 BFF 두 개를 먼저 교체

먼저 교체할 파일:

1. `frontend/app/api/dashboard/recommended-programs/route.ts`
2. `frontend/app/api/dashboard/recommend-calendar/route.ts`

이유:

- 추천 문맥이 가장 많이 섞여 있다.
- `_reason` 같은 임시 필드를 가장 빨리 제거할 수 있다.
- 카드형 summary + context 구조가 안정되면 대시보드 카드와 캘린더 추천이 같이 정리된다.

### 6.4 4단계: direct `programs` 조회 BFF 교체

그 다음 파일:

1. `frontend/app/api/dashboard/bookmarks/route.ts`
2. `frontend/app/api/dashboard/calendar-selections/route.ts`

이유:

- 이 둘은 이미 read-model-first + fallback으로 전환됐다.
- 다음 단계는 같은 summary/context 구조를 다른 read path에도 넓혀 상세/비교와의 drift를 줄이는 것이다.

### 6.5 5단계: shared helper 교체

그 다음 파일:

- `frontend/lib/api/backend.ts`

우선순위:

1. `listProgramsPage()`
2. `getPrograms()`
3. `getProgram()`
4. `getProgramDetail()`

이유:

- 실제 화면과 BFF가 이미 새 타입을 쓰기 시작한 뒤에 helper를 바꾸는 편이 안전하다.
- helper를 먼저 바꾸면 한 번에 영향을 받는 화면이 너무 많다.

### 6.6 6단계: 상세/비교 최종 정리

마지막 단계:

- `backend/routers/programs.py::get_program_detail()`
- `backend/routers/programs.py::get_program_details_batch()`
- `frontend/app/api/programs/compare-relevance/route.ts`
- 비교/상세 페이지 consumer

이유:

- 이 단계는 `programs` canonical detail과 `program_source_records` provenance 역할이 실제 코드에 반영된 뒤 consumer까지 정리해야 마무리된다.

## 7. 이번 문서에서 고정하는 판단

- 실제 첫 진입점은 `backend/routers/programs.py::_serialize_program_list_row()`다.
- frontend 첫 진입점은 `frontend/lib/types/index.ts::Program` 해체 준비다.
- BFF 첫 교체 대상은 `dashboard/recommended-programs`와 `dashboard/recommend-calendar`다.
- `dashboard/bookmarks`와 `dashboard/calendar-selections`는 이미 `program_list_index` 우선 read로 옮겨졌다.
- backend recommendation/compare read도 이제 `user_recommendation_profile` 우선 구조로 넘어갔다.
- `dashboard/recommend-calendar`의 마지막 direct Supabase fallback도 `program_list_index` 우선 helper로 정리됐다.
- `get_programs_batch()`도 compare 상단 카드 기준 `program_list_index` 우선으로 넘어갔고, 상세 단건/배치는 `program_source_records` 보강을 받기 시작했다.
- 이제 남은 직접 전환 우선순위는 추천 BFF cleanup과 비교/상세 read 쪽이다.
- `compare-relevance`는 먼저 만들 대상이 아니라, 앞 단계가 끝난 뒤 맞춰 들어가야 하는 얇은 proxy다.

## 8. 바로 다음 구현 턴에서 건드릴 최소 묶음

가장 안전한 다음 구현 묶음은 아래다.

1. backend 내부 serializer helper 추가
2. frontend 새 surface 타입 추가
3. `dashboard/recommended-programs/route.ts`에서 `_reason/_fit_keywords/_score` 직접 주입 제거 준비
4. `dashboard/recommend-calendar/route.ts` fallback `program: Program` 구조 축소 준비

이 순서면 기존 동작을 최대한 유지하면서도, 가장 큰 drift 두 군데부터 줄일 수 있다.
