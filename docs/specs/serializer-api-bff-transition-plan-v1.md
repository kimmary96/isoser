# Serializer API BFF Transition Plan v1

기준일: 2026-04-24  
상태: proposed  
범위: `program-surface-contract-v2` 기준 serializer / API / BFF 전환 순서

## 1. 문서 목적

이 문서는 “새 스키마를 만들고도 화면별 drift가 다시 생기지 않게 하려면 어떤 순서로 응답 구조를 옮겨야 하는가”를 정리한 문서다.

실제 저장소 파일과 함수 기준 진입점은 별도 문서 `serializer-api-bff-code-entrypoints-v1.md`를 함께 본다.

핵심 원칙은 단순하다.

- 먼저 serializer를 고정한다.
- 그 다음 API/BFF를 옮긴다.
- 마지막에 화면을 옮긴다.

## 2. 현재 저장소 기준으로 확인한 문제

- backend `ProgramListItem` 하나에 카드/목록/추천 문맥이 섞여 있다.
- frontend `Program` 타입 하나에 카드/목록/상세/추천/비교용 값이 모두 섞여 있다.
- 대시보드 추천 BFF 주 경로는 이미 `ProgramCardItem`으로 옮겨졌지만, `ProgramCardRenderable` 전이 별칭과 일부 helper cleanup은 아직 남아 있다.
- 북마크/캘린더 BFF도 summary read 우선 구조로 옮겨졌지만, 미적용 환경용 `programs` fallback과 helper 경계 cleanup은 남아 있다.
- 그래서 같은 `program_id`가 화면별로 다른 의미를 가질 위험이 남아 있다.

## 3. 최종 목표 구조

### 프로그램 payload

- `ProgramCardItem`
- `ProgramListRowItem`
- `ProgramDetailResponse`
- `ProgramCompareItem`

### 추천/노출 문맥

- `ProgramSurfaceContext`

중요:

- 추천은 프로그램 payload를 바꾸지 않는다.
- 추천은 `context`만 붙인다.

## 4. 1단계: serializer 고정

### backend에서 먼저 만들어야 할 것

- `serialize_program_base_summary()`
- `serialize_program_card_summary()`
- `serialize_program_list_row()`
- `serialize_program_detail_response()`
- `build_program_surface_context()`

### 이 단계에서 하는 일

- 아직 endpoint 모양을 바꾸지 않아도 된다.
- 먼저 내부 구현을 “raw row 직접 해석”에서 “serializer 함수 호출”로 바꾼다.

### 이 단계가 먼저여야 하는 이유

- serializer가 먼저 없으면 endpoint를 늘려도 화면별로 또 다른 formatter가 생긴다.

## 5. 2단계: backend API 전환

## 5.1 목록/카드 계열

우선순위:

1. `GET /programs/list`
2. `GET /programs/popular`
3. `GET /programs`

전환 방향:

- `program_list_index` 명시 컬럼으로 `ProgramCardItem` 또는 `ProgramListRowItem`을 만들 수 있어야 한다.
- 카드형 surface와 테이블형 surface는 같은 endpoint를 쓰더라도 같은 내부 serializer 뿌리를 공유해야 한다.

## 5.2 상세/비교 계열

우선순위:

1. `GET /programs/{id}/detail`
2. `POST /programs/details/batch`
3. 비교 본문 조립 경로

전환 방향:

- 상세는 `programs` 정본 + `program_source_records` 보강 구조로 만든다.
- 상세 응답은 `summary + detail (+ optional context)` 구조로 정리한다.

## 5.3 추천/비교 관련도 계열

우선순위:

1. `POST /programs/recommend`
2. `GET /programs/recommend/calendar`
3. `POST /programs/compare-relevance`

전환 방향:

- 추천/비교는 프로그램 요약을 새로 만들지 않는다.
- 이미 만들어진 `ProgramCardSummary` 또는 `ProgramBaseSummary`에 `context`를 붙인다.
- 사용자 입력은 `user_recommendation_profile`에서 읽는다.

## 6. 3단계: BFF 전환

## 6.1 가장 먼저 전환할 BFF

| BFF | 이유 |
| --- | --- |
| `frontend/app/api/dashboard/recommended-programs/route.ts` | 현재 `Program` 변형이 가장 심함 |
| `frontend/app/api/dashboard/recommend-calendar/route.ts` | 추천/기본 fallback을 같이 관리해 구조 정리가 중요함 |

이 두 경로는 추천 문맥과 프로그램 summary를 분리하는 효과가 가장 크다.

## 6.2 그 다음 전환할 BFF

| BFF | 이유 |
| --- | --- |
| `frontend/app/api/dashboard/bookmarks/route.ts` | 현재 `programs` direct read |
| `frontend/app/api/dashboard/calendar-selections/route.ts` | 현재 `programs` direct read |
| `frontend/app/api/programs/compare-relevance/route.ts` | 비교 응답 구조를 새 serializer와 맞춰야 함 |

## 6.3 마지막으로 전환할 BFF/helper

| 대상 | 이유 |
| --- | --- |
| landing/live board/opportunity helper | 카드형 surface로 한 번에 정리 가능 |
| 메인 `/programs` 목록 helper | 테이블형 row 계약이 완전히 준비된 뒤 전환하는 편이 안전 |
| 상세/비교 페이지 helper | 상세 계약 전환이 마지막이기 때문 |

## 7. 4단계: 프론트 화면 전환 순서

### 7.1 카드형 화면 먼저

1. 대시보드 추천  
2. 대시보드 북마크  
3. 라이브보드  
4. 오퍼튜니티 피드  
5. Closing Soon  
6. 비교 선택 모달

이유:

- 카드형은 `ProgramCardSummary + ProgramSurfaceContext`만 있으면 대부분 정리된다.

### 7.2 테이블형 목록 다음

1. 메인 `/programs` 테이블  

이유:

- 목록 테이블은 카드보다 더 많은 열과 라벨을 쓰므로, 카드형이 안정된 뒤 옮기는 편이 안전하다.

### 7.3 상세/비교 본문 마지막

1. 프로그램 상세  
2. 비교 본문  

이유:

- 이 단계는 `programs` canonical detail과 `program_source_records` 분리가 끝난 뒤에야 안전하게 옮길 수 있다.

## 8. 타입 전환 순서

### backend

- `ProgramListItem` 축소
- 상세 응답 전용 모델 분리
- 추천 context 전용 모델 분리

### frontend

- `frontend/lib/types/index.ts`의 `Program` monolith 해체
- `ProgramCardSummary`, `ProgramListRow`, `ProgramDetailResponse`, `ProgramSurfaceContext` 추가
- transition 기간에는 기존 `Program`을 남기되, 새 화면은 더 이상 의존하지 않게 유도

## 9. 안전한 전환 규칙

- 새 serializer가 준비되기 전에는 새 endpoint/BFF를 열지 않는다.
- 새 BFF가 준비되기 전에는 프론트 화면을 바꾸지 않는다.
- 한 화면에서 `program` 값과 `context` 값이 섞여 의미가 뒤바뀌는 구조를 허용하지 않는다.
- 북마크 여부, 추천 점수, 노출 사유는 `ProgramSurfaceContext`로만 내려보낸다.

## 10. 이번 문서에서 고정하는 판단

- 전환 순서의 출발점은 serializer다.
- backend API 전환보다 BFF 전환이 먼저가 아니라, backend serializer와 API가 먼저다.
- 카드형 화면을 먼저 옮기고, 테이블형 목록과 상세/비교는 뒤로 둔다.
- 추천 BFF의 `Program` 객체 변형 구조는 transition 이후 제거 대상이다.
