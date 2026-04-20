# Supervisor Inspection: TASK-2026-04-20-1545-compare-ai-fit-v2

## Task Summary

- `AGENTS.md` 확인 완료.
- task frontmatter 필수 필드(`id`, `status`, `type`, `title`, `planned_at`, `planned_against_commit`)가 모두 존재한다.
- `planned_against_commit` 값 `3bb4aff8213e310c129d00cd81588642ed03b3c3`는 현재 `HEAD`와 일치한다.
- optional metadata는 `planned_files`만 존재하고 `planned_worktree_fingerprint`는 없다.
- 직접 관련 구현 경로를 우선 점검한 결과, compare relevance 흐름은 packet 설명과 동일하게 유지되고 있다.
- 현재 단계에서 task packet 기준의 유의미한 drift나 blocked 사유는 확인되지 않았다.

## Touched files

- `frontend/app/(landing)/compare/programs-compare-client.tsx`
- `frontend/app/api/programs/compare-relevance/route.ts`
- `frontend/lib/api/app.ts`
- `frontend/lib/types/index.ts`
- `backend/routers/programs.py`
- `backend/tests/test_programs_router.py`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Implementation outline

- backend `ProgramRelevanceItem` / `ProgramCompareRelevanceResponse` 계약에 `fit_label`, `fit_summary`, `readiness_label`, `gap_tags`를 추가한다.
- 기존 `_compute_program_relevance_items(...)` 흐름을 유지한 채, 현재 `profile`, `activities`, `matched_skills`, `relevance_score`, `skill_match_score`를 기반으로 deterministic interpretation layer를 얹는다.
- 기존 `backend/rag/programs_rag.py`의 `_profile_keywords`, `_program_match_context`는 재사용하고 추천 계산 본체는 바꾸지 않는다.
- frontend shared type과 app helper/BFF는 새 응답 필드를 그대로 통과시키되 로그인 401 흐름은 유지한다.
- compare UI의 `★ 나와의 관련도` 섹션을 `★ AI 적합도`로 재구성하고, 기존 상태/점수/매칭 스킬 행은 유지하면서 `적합도 판단`, `지원 준비도`, `AI 한줄 요약`, `보완 포인트` 행을 추가한다.
- 문서 업데이트는 구조나 현재 동작 설명이 바뀐 범위만 최소 수정으로 반영한다.

## Verification plan

- backend router/unit test에 새 필드 계약과 label derivation 규칙을 추가한다.
- 프로필 정보가 약한 케이스에서 endpoint가 실패하지 않고 안정 응답하는지 회귀 테스트를 추가한다.
- frontend 기준 최소 `typecheck` 또는 빌드 가능 경로를 확인해 새 타입 필드 반영이 깨지지 않는지 점검한다.
- 가능하면 compare UI에서 비로그인/로딩/성공/실패 상태 문구가 기존 요구사항대로 유지되는지 확인한다.

## Preserved behaviors

- endpoint 경로는 계속 `POST /programs/compare-relevance`를 사용한다.
- 기존 응답 필드 `program_id`, `relevance_score`, `skill_match_score`, `matched_skills`는 유지한다.
- 로그인하지 않은 경우의 401 기반 흐름과 UI의 `로그인 후 확인` 표시는 유지한다.
- compare 페이지의 슬롯, URL state, 모달, 추천 카드, CTA 흐름은 이번 작업 범위 밖으로 유지한다.
- LLM 호출 없이 현재 규칙 기반 compare relevance 계산 경로를 재사용한다.

## Risks

- `readiness_label`이 실제 지원 자격 판정처럼 읽히지 않도록 문구 수위를 조심해야 한다.
- 현재 profile/activity 데이터가 약한 사용자에게 `낮음` 또는 gap tag가 과도하게 자주 노출될 수 있다.
- compare UI는 이미 표 구조가 길어서 새 행 추가 시 모바일/가로 스크롤 가독성이 더 나빠질 수 있다.
- backend 해석 규칙이 frontend 문구 기대와 어긋나면 label은 맞아도 UX가 부자연스러울 수 있으므로 contract와 UI copy를 같이 맞춰야 한다.
