# Result Report: TASK-2026-04-20-1545-compare-ai-fit-v2

## Changed files

- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `frontend/app/(landing)/compare/programs-compare-client.tsx`
- `frontend/lib/types/index.ts`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made

- 기존 `POST /programs/compare-relevance` 응답에 AI 적합도 v2 해석 레이어를 추가해, 기존 점수값을 사용자가 이해 가능한 `적합도 판단`, `지원 준비도`, `AI 한줄 요약`, `보완 포인트`로 확장했습니다.
- backend는 기존 relevance/skill match 계산을 유지한 채 `fit_label`, `fit_summary`, `readiness_label`, `gap_tags`를 deterministic rule로 파생하도록 최소 범위로 보강했습니다.
- frontend compare UI는 기존 점수/매칭 스킬 영역을 유지하면서 새 해석 필드를 렌더링하도록 바꿨고, 비로그인/로딩/실패 문구 규칙은 기존 요구사항대로 유지했습니다.
- backend 회귀 테스트는 새 계약 필드와 sparse profile 케이스를 고정하도록 추가했습니다.

## Preserved behaviors

- endpoint 경로는 계속 `POST /programs/compare-relevance`를 사용합니다.
- 기존 응답 필드 `program_id`, `relevance_score`, `skill_match_score`, `matched_skills`는 유지됩니다.
- 로그인하지 않은 사용자의 401 기반 흐름과 compare UI의 `로그인 후 확인` 표시는 유지됩니다.
- compare 페이지의 슬롯 구성, URL state, 추천 카드, CTA 흐름은 변경하지 않았습니다.
- LLM 호출 없이 기존 규칙 기반 relevance 계산 경로를 그대로 재사용합니다.

## Risks / possible regressions

- `readiness_label`과 `gap_tags`는 현재 profile/activity 데이터 밀도에 민감하므로, 정보가 적은 사용자에게 `낮음` 또는 보완 태그가 자주 노출될 수 있습니다.
- compare 표에 행이 늘어나 모바일 가독성이 다소 낮아질 수 있습니다.
- `fit_summary`는 템플릿 기반이므로 실제 UX copy 톤과 추가 조율이 필요할 수 있습니다.

## Follow-up refactoring candidates

- compare relevance UI의 상태 분기(`로그인 후 확인` / `분석 중` / `불러오기 실패` / `정보 없음`)를 작은 helper component로 분리하면 표 행 추가 시 중복을 더 줄일 수 있습니다.
- backend의 relevance interpretation helper를 별도 함수 묶음으로 더 정리하면 향후 threshold 조정 시 테스트 범위를 더 좁게 유지할 수 있습니다.

## Verification run

- `backend\venv\Scripts\python.exe -m pytest backend/tests/test_programs_router.py -q`
- `cd frontend && npx tsc --noEmit`
