# REFACTORING_REPORT

## 변경 요약

- 프로그램 목록/추천 관련 프론트 쿼리 파라미터 직렬화를 공통화했습니다.
- `/programs` 페이지의 필터/URL 정규화 로직을 별도 파일로 분리했습니다.
- `backend/routers/programs.py`의 요청/응답 스키마를 `backend/schemas/programs.py`로 분리했습니다.
- `/programs/list` read-model 경로에서 목록과 count를 병렬 조회하도록 바꿨습니다.
- `backend/routers/programs.py`의 목록 검색/정렬/필터 pure helper를 `backend/services/program_list_filters.py`로 분리했습니다.
- `/programs` 테이블 렌더링과 포맷팅 helper를 별도 파일로 분리했습니다.
- 백엔드 표준 로컬 가상환경 기준을 `backend/venv`로 문서화하고 검증 스크립트를 추가했습니다.
- 프로그램 목록 API 예시를 fixture와 schema test로 고정했습니다.
- 프론트 Vitest 별칭 해석 설정을 추가해 전체 테스트가 다시 통과하도록 정리했습니다.

## 변경한 파일 목록

- `frontend/lib/api/program-query.ts`
- `frontend/lib/types/index.ts`
- `frontend/lib/api/backend.ts`
- `frontend/lib/api/app.ts`
- `frontend/app/api/dashboard/recommend-calendar/route.ts`
- `frontend/app/(landing)/programs/page-filters.ts`
- `frontend/app/(landing)/programs/page.tsx`
- `frontend/app/(landing)/programs/programs-table.tsx`
- `frontend/app/(landing)/programs/programs-table-helpers.ts`
- `frontend/app/(landing)/programs/programs-urgent-card.tsx`
- `frontend/vitest.config.ts`
- `backend/schemas/programs.py`
- `backend/schemas/__init__.py`
- `backend/services/program_list_filters.py`
- `backend/routers/programs.py`
- `backend/README.md`
- `backend/tests/fixtures/program_list_api_examples.json`
- `backend/tests/test_program_list_api_examples.py`
- `scripts/run-backend-checks.ps1`

## 삭제/이동한 파일 목록

- 삭제 없음
- 이동 대신 `backend/routers/programs.py` 내부 모델 정의를 `backend/schemas/programs.py`로 분리
- 이동 대신 `backend/routers/programs.py` 내부 pure helper 다수를 `backend/services/program_list_filters.py`로 분리

## 주요 개선점

- 프로그램 query 직렬화가 한곳으로 모여 유지보수성이 좋아짐
- 비어 있는 상속 interface를 type alias로 정리해 프론트 빌드/타입체크 경고를 제거함
- `/programs` 페이지 전용 필터 로직이 page 본문에서 분리됨
- 라우터와 스키마 책임이 분리됨
- 라우터와 목록 pure helper 책임이 분리됨
- `/programs` 페이지 본문과 렌더링 컴포넌트 책임이 분리됨
- 프로그램 목록/count/filter-options 예시 응답이 fixture와 테스트로 고정됨

## 성능 개선 내용

- `/programs` 페이지에서 세션/북마크 조회를 초기에 시작해 직렬 대기를 줄임
- `/programs/list` read-model 경로에서 목록 데이터 fetch와 count 조회를 병렬 처리
- `/programs` 페이지에서 긴 렌더링/포맷팅 로직을 분리해 변경 범위와 회귀 위험을 줄임

## 아직 남은 문제

- `backend/routers/programs.py`는 여전히 대형 파일이며, 상세 응답 조립/helper 분리가 더 필요함
- 백엔드 전체 테스트 스위트 기준 추가 검증은 계속 필요함

## 다음 리팩토링 제안

1. `backend/routers/programs.py`의 상세 응답 조립/helper를 `backend/services/`로 추가 분리
2. 프로그램 목록 페이지 pagination/result summary 블록도 전용 컴포넌트로 더 분리
3. 백엔드 전체 테스트 스위트를 `scripts/run-backend-checks.ps1 -Full` 기준으로 CI에 연결
4. 목록/필터 쿼리 계약 예시를 OpenAPI 또는 프론트 테스트와도 추가 연동
