# SESSION-2026-04-26-program-explore-filter-qa-result

## changed files
- `backend/services/program_list_filters.py`
- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `frontend/app/(landing)/programs/page-helpers.test.ts`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## why changes were made
- `/programs`의 카테고리/추천 대상 필터가 sparse read-model 컬럼을 그대로 믿으면서 실제 텍스트 기반 분류 결과를 반영하지 못했다.
- 추천 대상 옵션에 `중장년`, `구직자`처럼 추론 기준이 모호한 항목이 남아 있어 필터 의미와 실제 row 매칭 기준이 어긋났다.
- 선발절차와 키워드 노출도 QA 요구와 달리 `선발 절차 없음` 같은 불필요한 텍스트를 그대로 보여줄 수 있었다.

## preserved behaviors
- 기존 `/programs`, `/programs/list`, `/programs/count`, `/programs/filter-options` 엔드포인트 구조는 유지했다.
- DB 스키마와 read-model 테이블 구조는 건드리지 않았다.
- 기본 browse, recent closed, promoted/ad, 정렬 규칙은 그대로 유지하고, 로컬 파생 필터가 필요한 경우에만 legacy post-process 경로로 우회한다.

## risks / possible regressions
- 제목/설명 기반 태그 추론은 보수적으로 잡았지만, 특정 공고 문구가 비정형이면 카테고리나 추천 대상이 과소 분류될 수 있다.
- 로컬 파생 필터가 걸린 요청은 read-model 대신 legacy 후처리 경로를 쓰므로, 기본 browse보다 응답 비용이 다소 늘 수 있다.
- 현재 검증은 단위 테스트 중심이며 실제 브라우저 환경의 전체 상호작용은 이번 세션에서 자동화하지 못했다.

## follow-up refactoring candidates
- 카테고리/추천 대상 파생 태그를 read-model refresh 단계로 끌어올려 browse 경로에서도 완전히 같은 기준을 쓰게 만들기
- `/programs` 표 컴포넌트의 source/logo 표현과 ad/urgent row 시각 규칙을 전용 UI helper로 분리하기
- 필터별 실제 결과 수 변화를 브라우저 시각 QA나 Playwright 시나리오로 고정하기
