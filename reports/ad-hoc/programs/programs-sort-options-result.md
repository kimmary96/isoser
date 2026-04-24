# Programs Sort Options Result

## 상태

completed

## 변경 파일

- `frontend/app/(landing)/programs/page.tsx`
- `frontend/app/(landing)/programs/programs-filter-bar.tsx`
- `frontend/lib/types/index.ts`
- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## 변경 이유

프로그램 목록 정렬 필터가 `마감 임박순`과 `최신순`만 제공했고, `최신순`은 DB row 생성 시각(`created_at`) 기준이라 사용자가 기대하는 탐색 기준과 맞지 않았다. 요청 이미지의 목록처럼 기본, 마감, 개강, 비용, 기간 기준 정렬을 제공하도록 정렬 계약과 UI를 확장했다.

## 변경 내용

- 정렬 드롭다운 옵션을 `기본 정렬`, `마감 임박순`, `개강 빠른순`, `비용 낮은순`, `비용 높은순`, `짧은 기간순`, `긴 기간순`으로 교체했다.
- 프론트 `ProgramSort` 타입을 새 정렬 값(`default`, `deadline`, `start_soon`, `cost_low`, `cost_high`, `duration_short`, `duration_long`) 기준으로 확장했다.
- 백엔드 `/programs` 목록 정렬에 개강일, 비용, 기간 후처리 정렬을 추가했다.
- 기본 정렬은 기존 기본 노출 정책을 유지하고, `latest`는 UI에서는 제거하되 API 호환을 위해 백엔드 허용값으로 남겼다.

## 보존한 동작

- 기본 목록은 계속 모집중 프로그램 중심으로 노출된다.
- 마감 임박 레일은 기존처럼 별도 `deadline` 정렬 조회를 사용한다.
- 검색/카테고리/지역/수업방식/비용/참여시간/운영기관/추천대상 필터 query 이름은 유지했다.
- 기존 `sort=latest` API 요청은 백엔드에서 계속 처리된다.

## 영향 범위

- 공개 `/programs` 목록 페이지의 정렬 UI와 URL query
- 백엔드 `GET /programs` 목록 정렬
- 프로그램 목록 타입 계약과 router 회귀 테스트

## 리스크 / 가능한 회귀

- 비용은 source별 수집 품질이 달라 `cost` 또는 비용성 `compare_meta` 값이 없으면 해당 row를 비용 정렬 뒤쪽으로 보낸다.
- 개강일/기간은 `start_date`/`end_date` 및 일부 metadata fallback을 사용하므로, 창업 공고처럼 교육 과정이 아닌 row에서는 실제 "개강" 의미와 다를 수 있다.
- 후처리 정렬은 후보 scan 후 정렬하므로 데이터가 더 커지면 응답 시간이 늘 수 있다.

## 테스트 포인트

- `sort=start_soon`에서 개강일 빠른 프로그램이 먼저 나오는지
- `sort=cost_low` / `sort=cost_high`에서 비용 미확인 row가 뒤로 밀리는지
- `sort=duration_short` / `sort=duration_long`에서 기간 미확인 row가 뒤로 밀리는지
- 검색어가 있을 때 `기본 정렬`은 검색 매칭 순위를 유지하고, 명시 정렬은 선택한 기준을 적용하는지

## 검증

- `backend\venv\Scripts\python.exe -m pytest backend/tests/test_programs_router.py -q`
- `npm run lint`
- `npx tsc -p tsconfig.codex-check.json --noEmit`
- 기존 로컬 프론트 서버 `http://localhost:3000/programs?sort=cost_low` 응답 200 및 `비용 낮은순` 라벨 포함 확인

## 추가 리팩토링 후보

- 비용/기간/개강일 정규화 helper를 `backend/routers/programs.py`에서 별도 프로그램 목록 정규화 모듈로 분리한다.
- 운영 DB에 정규화된 `start_sort_date`, `duration_days`, `cost_amount` 컬럼을 두어 후보 scan 비용을 줄인다.
- 창업/행사 공고와 교육 과정의 날짜 의미를 분리해 `개강 빠른순` 정확도를 높인다.
