# TASK-2026-04-20-1705 Public UI Deadline Alignment Result

- changed files
  - `backend/routers/programs.py`
  - `backend/tests/test_programs_router.py`
  - `frontend/app/(auth)/login/page.tsx`
  - `frontend/app/(landing)/landing-a/_components.tsx`
  - `frontend/app/(landing)/landing-a/_styles.ts`
  - `frontend/app/(landing)/programs/page.tsx`
  - `frontend/app/(landing)/compare/programs-compare-client.tsx`
  - `frontend/app/(landing)/compare/program-select-modal.tsx`
  - `frontend/lib/api/backend.ts`
  - `frontend/lib/types/index.ts`
  - `docs/current-state.md`
  - `docs/refactoring-log.md`

- why changes were made
  - 로그인 화면과 공개 랜딩/비교 화면의 시각 톤이 워크스페이스와 달라 제품 흐름이 끊겨 보이던 문제를 줄이기 위해 라이트 톤으로 정리했다.
  - 메인 랜딩 카피를 사용자 지정 문구로 교체하고, 검은 배경 위 낮은 대비 텍스트를 제거해 가독성을 높였다.
  - 메인 랜딩과 프로그램 검색에서 이미 마감된 공고가 노출되던 문제를 `is_active`가 아니라 실제 `deadline` 기준으로 다시 계산하도록 수정했다.
  - 프로그램 목록 기본값을 모집중 중심으로 바꾸고, 사용자가 체크했을 때만 최근 3개월 마감 공고를 함께 보도록 필터 계약을 바꿨다.

- preserved behaviors
  - 공개 라우트(`/landing-a`, `/programs`, `/compare`, `/login`)와 로그인 후 대시보드 라우트 구조는 유지했다.
  - compare 페이지의 3슬롯 URL state, 프로그램 추가/제거, 로그인 사용자 관련도 계산 흐름은 유지했다.
  - 프로그램 목록의 검색, 카테고리/지역 필터, 페이지네이션 기본 동작은 유지했다.

- risks / possible regressions
  - `deadline`이 비어 있거나 비정상인 source 데이터는 기본 목록에서 후순위 처리되거나 제외될 수 있다.
  - backend pytest는 시스템 기본 `python`이 3.13이라 직접 호출 시 가드에 막히므로, 항상 `backend/venv/Scripts/python.exe`를 사용해야 한다.
  - `landing-b` 실험 경로는 아직 남아 있어, 운영에서 혼선을 줄이려면 후속 정리가 필요할 수 있다.

- follow-up refactoring candidates
  - `landing-b` 경로를 계속 유지할지 검토하고, 필요 없다면 `/landing-a`로 정리한다.
  - 프로그램 목록/비교에서 공통으로 쓰는 deadline badge 계산과 공개 상태 문구를 shared helper로 추출한다.
  - source별 `deadline` 정규화 품질을 높여 `마감 추정`과 `데이터 미수집` 상태를 더 명확히 구분한다.
