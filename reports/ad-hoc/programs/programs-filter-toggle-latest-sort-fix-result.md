# Programs Filter Toggle / Latest Sort Fix Result

## 변경 파일
- `frontend/app/(landing)/programs/programs-filter-bar.tsx`
- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## 변경 이유
- 다중 필터 드롭다운에 `선택 적용` 버튼이 남아 있어 사용자가 필터 항목을 누른 뒤 한 번 더 저장해야 하는 흐름으로 보였다.
- `/programs?sort=latest`에서 최신 원천 데이터 첫 묶음이 마감일을 확정할 수 없는 항목으로 채워지면, 프론트의 표시 가능 조건을 통과하는 프로그램이 없어 빈 검색 결과처럼 보였다.

## 변경 내용
- 다중 필터 메뉴에서 `선택 적용` 버튼을 제거했다.
- 지역/비용/참여 시간/기관/대상/절차/연계 필터 항목을 클릭하면 선택 상태를 바꾸고 메뉴를 즉시 닫도록 했다.
- `전체선택` 클릭도 선택값을 비우고 메뉴를 즉시 닫도록 했다.
- 백엔드 프로그램 목록 후처리에 `recruiting_only=true` 기준을 추가해 실제 `days_left >= 0`인 프로그램만 남기도록 했다.
- 고용24에서 `deadline`이 훈련 종료일(`end_date`)과 같은 경우에는 모집 마감일로 쓰지 않는 기존 보정 규칙을 목록과 카운트 모두에 적용했다.
- 최신순 모집중 조회는 Supabase의 기본 첫 페이지 제한에 걸리지 않도록 1,000건 단위 후보 scan을 사용한다.

## 보존한 동작
- 필터 선택값은 기존처럼 상단 `검색` 버튼으로 URL query에 반영된다.
- 정렬 select는 기존처럼 변경 즉시 제출된다.
- `deadline` 정렬, 검색어 검색, 추가 필터 파라미터 이름은 유지했다.
- 목록 화면의 표시 가능 조건인 제목/source/마감일 필요 조건은 유지했다.

## 검증
- `backend\venv\Scripts\python.exe -m pytest backend\tests\test_programs_router.py`: 47 passed
- `frontend` 폴더에서 `npx tsc -p tsconfig.codex-check.json --noEmit`: 통과
- `GET http://localhost:8000/programs/?recruiting_only=true&sort=latest&limit=5`: 5개 결과 반환 확인
- `http://localhost:3000/programs?sort=latest`: 전체 프로그램 51개와 테이블 행 표시 확인
- 브라우저에서 지역 필터를 열고 `서울` 클릭 시 드롭다운이 닫히고 `선택 적용` 버튼이 보이지 않는 것 확인

## 리스크 / 가능한 회귀
- 최신순 모집중 조회는 더 넓은 후보를 가져오므로, 데이터가 매우 많아지면 API 응답 시간이 늘 수 있다.
- 다중 필터가 항목 클릭 즉시 닫히므로 여러 항목을 연속 선택하려면 메뉴를 다시 열어야 한다.

## 추가 리팩토링 후보
- `MultiFilterMenu`를 단일 선택처럼 쓸 필터와 다중 선택을 유지할 필터로 분리하면 UX 정책을 더 명확히 관리할 수 있다.
- 최신순 모집중 조회는 장기적으로 DB 쪽에 “보정된 모집 마감일” 컬럼을 저장해 백엔드 후보 scan 비용을 줄이는 편이 좋다.
