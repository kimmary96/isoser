# SESSION-2026-04-24-structure-cleanup-refactor-result

## changed files

- `frontend/lib/api/program-query.ts`
- `frontend/lib/api/program-query.test.ts`
- `frontend/lib/types/index.ts`
- `frontend/lib/api/backend.ts`
- `frontend/lib/api/app.ts`
- `frontend/app/api/dashboard/recommend-calendar/route.ts`
- `frontend/app/(landing)/programs/page-filters.ts`
- `frontend/app/(landing)/programs/page.tsx`
- `frontend/vitest.config.ts`
- `backend/schemas/programs.py`
- `backend/schemas/__init__.py`
- `backend/routers/programs.py`
- `docs/PROJECT_STRUCTURE.md`
- `docs/API_STRUCTURE.md`
- `docs/REFACTORING_REPORT.md`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## why changes were made

- 프로그램 목록/추천 query 직렬화 중복을 줄이고 API 파라미터 처리 기준을 고정하기 위해
- 프론트 빌드를 막던 빈 interface 선언 경고를 정리하기 위해
- `/programs` 페이지의 과도한 파일 책임을 낮추기 위해
- `backend/routers/programs.py`의 요청/응답 모델을 분리해 라우터 집중도를 낮추기 위해
- `/programs/list` read-model 응답에서 count 대기 시간을 줄이기 위해
- 프론트 테스트가 별칭 해석 문제로 실패하던 상태를 복구하기 위해

## preserved behaviors

- 프로그램 목록/상세/추천의 공개 응답 구조는 유지
- 기존 query key 이름은 유지
- DB 스키마, migration, 데이터는 변경하지 않음
- `/programs` 화면 흐름과 주요 UI 구조는 유지

## risks / possible regressions

- `backend/routers/programs.py` 스키마 import 경로가 런타임 환경별 import fallback에 의존하므로, 배포 전 백엔드 실제 부팅 확인이 필요
- `/programs/list` 병렬화는 동작은 같아야 하지만, read-model count 경로 예외가 날 경우 fallback 로그를 한 번 더 확인할 필요가 있음
- `page-filters.ts` 분리 후 `/programs` URL 조합이 기존과 완전히 동일한지 실제 브라우저 점검이 남음

## follow-up refactoring candidates

- `backend/services/`로 프로그램 목록 검색/정렬 pure helper 추가 분리
- `/programs` 테이블 렌더링 컴포넌트 추가 분리
- 백엔드 Python 3.10 테스트 환경 표준화
