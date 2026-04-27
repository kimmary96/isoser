# SESSION-2026-04-24-programs-helper-split-and-api-fixture-result

## Changed files

- `backend/services/program_list_filters.py`
- `backend/routers/programs.py`
- `backend/schemas/programs.py`
- `backend/README.md`
- `backend/tests/fixtures/program_list_api_examples.json`
- `backend/tests/test_program_list_api_examples.py`
- `scripts/run-backend-checks.ps1`
- `frontend/app/(landing)/programs/page.tsx`
- `frontend/app/(landing)/programs/programs-table.tsx`
- `frontend/app/(landing)/programs/programs-table-helpers.ts`
- `frontend/app/(landing)/programs/programs-urgent-card.tsx`
- `docs/current-state.md`
- `docs/refactoring-log.md`
- `docs/PROJECT_STRUCTURE.md`
- `docs/API_STRUCTURE.md`
- `docs/REFACTORING_REPORT.md`

## Why changes were made

- `backend/routers/programs.py` 내부의 목록 검색/정렬/필터/표시 파생 pure helper가 너무 커서 라우터 유지보수성이 떨어지고 있었음
- `/programs` 페이지의 렌더링/포맷팅 로직이 `page.tsx` 안에 과도하게 몰려 있었음
- 실제 백엔드 표준 가상환경 경로가 문서에 고정되지 않아 검증 경로가 혼동될 수 있었음
- 프로그램 목록 API 예시가 문서 설명에만 머물러 있어 계약 drift를 테스트로 잡기 어려웠음

## Preserved behaviors

- 기존 `/programs`, `/programs/list`, `/programs/count`, `/programs/filter-options` 공개 응답 구조 유지
- `/programs` 페이지의 필터, 정렬, 페이지네이션, 찜, 마감임박 카드 표시 유지
- DB 스키마/데이터 변경 없음
- 백엔드/프론트 기존 주요 테스트 통과

## Risks / possible regressions

- `backend/routers/programs.py`는 여전히 큰 파일이라 상세 응답 조립부 추가 분리 시 import/callback 경계를 다시 점검해야 함
- `scripts/run-backend-checks.ps1`는 현재 PowerShell 기준이므로 다른 셸 사용자는 별도 래퍼가 필요할 수 있음
- Python 3.10은 `google.api_core` 경고가 남아 있어 장기적으로 3.11+ 업그레이드 검토가 필요함

## Follow-up refactoring candidates

- `backend/routers/programs.py`의 detail response/helper cluster를 `backend/services/`로 추가 분리
- `/programs` 페이지의 결과 요약/페이지네이션 블록도 별도 컴포넌트로 분리
- 프론트 query fixture와 backend API fixture를 같은 contract source로 묶는 테스트 추가
