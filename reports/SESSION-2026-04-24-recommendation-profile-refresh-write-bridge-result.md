# SESSION-2026-04-24 Recommendation Profile Refresh Write Bridge Result

## Changed Files

- `frontend/lib/server/recommendation-profile.ts`
- `frontend/lib/server/recommendation-profile.test.ts`
- `frontend/app/api/dashboard/profile/route.ts`
- `frontend/app/api/dashboard/resume/route.ts`
- `frontend/app/api/dashboard/activities/route.ts`
- `frontend/app/api/dashboard/activities/[id]/route.ts`
- `docs/specs/final-refactor-migration-roadmap-v1.md`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why Changes Were Made

- 실제 저장소를 다시 확인해보니 roadmap 상태표가 최신 구현보다 뒤처져 있어, 패키지 3 진행 상태와 패키지 4 일부 seed 반영 상태를 먼저 문서에 맞춰둘 필요가 있었다.
- 현재 추천 정본 SQL 초안은 이미 존재하지만, profile/resume/activity 저장 뒤 `refresh_user_recommendation_profile()`가 실제로 호출되지 않아 새 구조가 비어 있을 가능성이 남아 있었다.
- 현재 프로필 UI는 아직 `bio` 입력을 "희망 직무"처럼 쓰고 있어, additive `profiles.target_job`가 있는 환경에서도 최신 사용자 입력이 정본 컬럼으로 반영되지 않는 공백이 있었다.

## Preserved Behaviors

- 프로필, 이력서, 활동 저장 자체의 기존 성공/실패 기준은 바꾸지 않았다.
- 추천 정본 refresh 함수나 관련 테이블/컬럼이 아직 없는 환경에서는 새 side effect가 저장을 막지 않고 조용히 건너뛴다.
- 현재 UI에서 보이는 희망 직무 입력 위치는 그대로 유지했다. 이번 변경은 저장 시 새 컬럼을 같이 채우는 bridge만 추가했다.

## Risks / Possible Regressions

- `recommendations` 삭제 권한이나 RPC 실행 권한이 환경별로 다를 수 있어, 일부 배포 환경에서는 side effect가 soft-fail 로그만 남기고 실제 갱신이 건너뛰어질 수 있다.
- 현재 UI가 여전히 `bio`를 희망 직무로 쓰는 동안에는 `bio`의 본래 의미와 추천 입력 의미가 완전히 분리된 것은 아니다.
- `profile/resume/activity` 저장 뒤 캐시를 전부 비우는 방식은 안전하지만, 추천을 다시 읽는 첫 요청에서는 재계산 비용이 잠시 늘 수 있다.

## Follow-up Refactoring Candidates

- profile UI/API에서 `bio`와 `target_job` 입력을 실제로 분리
- backend 추천 read를 raw `profiles + activities`에서 `user_recommendation_profile` 우선 구조로 전환
- `dashboard/bookmarks`, `dashboard/calendar-selections` 내부 read를 `programs` direct read에서 `program_list_index` summary read로 교체
