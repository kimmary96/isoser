# SESSION-2026-04-24 click hotness frontend surface result

## changed files

- `frontend/app/(landing)/landing-c/page.tsx`
- `frontend/app/(landing)/landing-c/_program-utils.ts`
- `frontend/app/(landing)/landing-c/_program-utils.test.ts`
- `frontend/app/(landing)/programs/[id]/program-detail-client.tsx`
- `frontend/app/(landing)/programs/page.tsx`
- `frontend/tsconfig.codex-check.tsbuildinfo`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## why changes were made

- 랜딩 C `Live Board`가 실제 상세 클릭 신호를 우선 반영하도록 read-model `popular` 정렬을 사용하게 했다.
- 프로그램 상세 진입 시 click hotness 집계를 실제로 쌓도록 클라이언트에서 BFF 추적 호출을 연결했다.
- `ProgramSort`에 `popular`가 추가된 뒤 `/programs` 정렬 라벨 맵이 빠져 있던 타입 오류를 정리했다.

## preserved behaviors

- 클릭 집계가 없는 경우 `Live Board`는 기존 만족도/리뷰/추천 proxy 정렬로 fallback한다.
- `Opportunity feed`의 기본/마감임박 칩 정렬 규칙은 유지한다.
- 동일 상세 페이지에서 같은 program id에 대한 중복 추적 호출은 ref guard로 막는다.

## risks / possible regressions

- 상세 페이지 최초 렌더 때 추적 호출이 실패하면 다음 재진입까지 집계가 비어 있을 수 있다.
- 랜딩 C 인기 목록은 read-model refresh 시차에 따라 실제 최신 클릭과 짧게 어긋날 수 있다.
- `tsconfig.codex-check.tsbuildinfo`는 생성 파일이라 추후 다른 타입 변경 때 다시 크게 흔들릴 수 있다.

## follow-up refactoring candidates

- 상세 추적 호출을 공용 analytics helper로 올려 다른 인기 지표와 통합
- 랜딩 C `Live Board` fetch limit와 7일 컷오프를 설정값으로 분리
- `/programs` 정렬 옵션 정의를 단일 상수 모듈로 모아 backend/frontend 계약 중복을 줄이기
