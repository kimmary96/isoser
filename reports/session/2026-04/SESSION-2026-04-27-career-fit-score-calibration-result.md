# 커리어 핏 점수 보정 결과

## Changed files
- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `frontend/app/(landing)/compare/compare-relevance-section.tsx`
- `frontend/app/(landing)/compare/compare-relevance-section.test.ts`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made
- 다른 팀원의 로컬 QA 결과를 현재 코드와 대조한 결과, 기존 커리어 핏 산식은 직무/스킬 비중이 높고 활동/행동 비중이 낮아 화면 문구의 `내 이력, 활동, 과정 데이터` 방향보다 직무 필터 성격이 강했다.
- 기존 화면 단계 기준 `0.28 / 0.46 / 0.64 / 0.82`는 낮은 매칭 사용자를 1단계에 오래 머물게 했고, backend `fit_label` 기준과도 어긋날 수 있었다.
- `온라인` 전달방식은 지역 매칭 점수에 크게 반영되어 커리어 핏보다 접근성 신호가 과대 반영될 수 있었다.
- 화면 chip은 직접 매칭 근거와 과정 메타데이터를 함께 보여줘 chip 수가 곧 점수 근거처럼 보일 수 있었다.

## Preserved behaviors
- `POST /programs/compare-relevance` 응답 shape와 기존 필드명은 유지했다.
- `matched_regions`에 `온라인`/`혼합` chip을 내려주는 표시 동작은 유지했다.
- RAG 직접 매칭 점수와 breakdown 점수 중 큰 값을 채택하는 기존 compare relevance 흐름은 유지했다.
- 비교 페이지의 3행 구조인 `커리어 핏 단계`, `맞닿은 키워드`, `AI 코멘트 한스푼`은 유지했다.

## Risks / possible regressions
- 활동이나 찜/캘린더 행동이 있는 사용자는 이전보다 커리어 핏 단계가 올라갈 수 있다.
- 온라인 과정은 접근성 chip은 보이지만 점수 가점은 줄어, 지역 기반 점수만 기대한 QA 결과와 달라질 수 있다.
- `맞닿은 키워드`가 두 그룹으로 나뉘며 비교 표 셀 높이가 일부 늘어날 수 있다.

## Test points
- 활동 키워드가 과정 키워드와 실제로 겹치는 사용자는 `experience`가 최대 반영되는지 확인한다.
- 찜/캘린더에 담긴 같은 과정은 `behavior` 10점이 반영되는지 확인한다.
- 온라인 과정은 `온라인` chip은 유지되지만 `region` 점수가 0인지 확인한다.
- `relevance_score` 0.20, 0.40, 0.55, 0.70 경계에서 각각 2/3/4/5단계로 보이는지 확인한다.
- 직접 근거 chip과 과정 메타 chip이 중복 없이 분리되는지 확인한다.

## Verification
- `backend\venv\Scripts\python.exe -m pytest backend\tests\test_programs_router.py -q -k "compute_program_relevance_items or compute_region_match"`: passed.
- `backend\venv\Scripts\python.exe -m py_compile backend\routers\programs.py backend\tests\test_programs_router.py`: passed.
- `npm --prefix frontend test -- "app/(landing)/compare/compare-relevance-section.test.ts"`: passed.
- `npm --prefix frontend run lint -- --file "app/(landing)/compare/compare-relevance-section.tsx" --file "app/(landing)/compare/compare-relevance-section.test.ts"`: passed.
- `npx --prefix frontend tsc -p frontend\tsconfig.codex-check.json --noEmit --pretty false`: passed.

## Follow-up refactoring candidates
- compare relevance 산식 상수를 route 파일에서 recommendation service module로 분리한다.
- `fit_label`, `relevance_grade`, 화면 5단계 기준을 공통 정책 객체로 묶어 기준 drift를 줄인다.
- 직접 매칭 chip과 과정 메타 chip을 backend 응답에서 구조화해 frontend 추론을 줄인다.
