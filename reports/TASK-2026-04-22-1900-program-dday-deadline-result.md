# TASK-2026-04-22-1900-program-dday-deadline Result

## 변경 파일
- `backend/routers/programs.py`
- `backend/rag/programs_rag.py`
- `backend/tests/test_programs_router.py`
- `frontend/app/(landing)/programs/page.tsx`
- `frontend/app/(landing)/programs/[id]/program-detail-client.tsx`
- `frontend/app/(landing)/landing-c/page.tsx`
- `frontend/app/dashboard/page.tsx`
- `frontend/components/MiniCalendar.tsx`
- `cowork/packets/TASK-2026-04-22-1900-program-dday-deadline.md`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## 왜 변경했는가
- 프로그램 카드 D-day가 모집 마감일이 아니라 교육/운영 종료일(`end_date`)로 계산될 수 있었다.
- 특히 고용24는 기존 수집 경로에서 훈련 종료일이 `deadline`으로도 저장될 수 있어, 단순히 `deadline`만 보는 수정으로는 오표시가 남을 수 있었다.

## 보존한 동작
- 훈련/운영 기간 표시는 계속 `start_date`/`end_date`를 사용한다.
- K-Startup처럼 `end_date` 자체가 신청 종료일인 source는 기존 상세 일정 매핑을 유지한다.
- 프로그램 목록, 비교, 추천 API의 기존 응답 구조는 유지한다.

## 수정 내용
- 백엔드 D-day 기준을 `close_date` 또는 `deadline`으로 제한하고, `end_date` fallback을 제거했다.
- 고용24 row에서 `close_date`가 없고 `deadline`과 `end_date`가 같은 경우, 해당 값은 훈련 종료일로 보고 D-day 계산에서 제외한다.
- RAG 추천의 `urgency_score`와 `days_left` 계산도 같은 모집 마감일 기준으로 맞췄다.
- 프로그램 목록, 상세 Hero, landing-c live board, 대시보드 필터/캘린더에서 `end_date`를 D-day 대체값으로 쓰던 경로를 제거했다.
- `MiniCalendar`는 `end_date` 대신 `deadline` 날짜에 프로그램을 표시한다.

## 테스트 결과
- `backend\\venv\\Scripts\\python.exe -m pytest backend/tests/test_programs_router.py backend/tests/test_work24_kstartup_field_mapping.py`
  - 38 passed
- `npm run lint`
  - 통과
- `npx tsc --noEmit --project tsconfig.codex-check.json`
  - 통과
- 참고: 루트의 기본 `python`은 3.13이라 프로젝트 Python 3.10 가드에 막혔고, backend venv Python 3.10.8로 재실행했다.

## 리스크 / 가능한 회귀
- 기존 DB에 이미 고용24 훈련 종료일이 `deadline`으로 저장된 row는 목록 필터/정렬 단계에서는 아직 DB 컬럼 값의 영향을 받을 수 있다. 이번 패치는 카드 D-day/추천 urgency 표시 오표시를 막는 범위다.
- 모집 마감일이 없는 프로그램은 D-day가 사라지거나 `정보 없음` 계열 fallback으로 보일 수 있다. 이는 종료일로 오표시하는 것보다 정확한 동작이다.
- 캘린더에 과거 localStorage로 저장된 프로그램 중 `deadline` 없이 `end_date`만 있는 항목은 캘린더 날짜 셀에 표시되지 않는다.

## 추가 리팩토링 후보
- 고용24 수집/관리자 sync에서 훈련 종료일을 `deadline`에 저장하는 경로를 별도 migration/backfill task로 정리한다.
- `deadline`, `close_date`, `start_date`, `end_date`의 source별 의미를 중앙 필드 매핑 테이블에 명시하고 저장 시점 검증 로그를 추가한다.
- 운영 DB에서 `source='고용24' AND deadline=end_date AND close_date IS NULL`인 row를 추출해 실제 모집 마감일 보강 대상 리포트를 만든다.
