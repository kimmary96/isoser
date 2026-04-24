# SESSION-2026-04-24 User Recommendation SQL Drafts And Contract Result

## Changed Files

- `supabase/migrations/20260425103000_add_profiles_target_job_columns.sql`
- `supabase/migrations/20260425104000_create_user_program_preferences.sql`
- `supabase/migrations/20260425105000_create_user_recommendation_profile.sql`
- `supabase/migrations/20260425110000_create_user_recommendation_profile_refresh_function.sql`
- `supabase/migrations/20260425111000_backfill_user_recommendation_inputs.sql`
- `supabase/migrations/20260425112000_align_recommendations_with_user_recommendation_profile.sql`
- `docs/specs/user-recommendation-serializer-contract-v1.md`
- `docs/specs/README.md`
- `docs/refactoring-log.md`
- `reports\session\2026-04\SESSION-2026-04-24-user-recommendation-sql-drafts-and-contract-result.md`

## Why Changes Were Made

- 사용자 추천 스키마를 문서 수준에서 끝내지 않고 실제 migration SQL 초안 파일 단위까지 내려 이후 구현을 바로 시작할 수 있게 하기 위해 정리했다.
- 추천 결과가 프로그램 정본을 덮어쓰지 않도록, `program-surface-contract-v2`와 연결되는 serializer / profile derivation 계약을 별도 스펙으로 고정했다.
- `cowork/drafts/relevance-scoring-v2.md`의 관련도 가중치 방향은 유지하되, 현재 저장소 기준 drift 지점(`profiles.target_job` 부재, `program_bookmarks` 정본, `preferred_regions` 도입)을 반영해 보정했다.

## Preserved Behaviors

- 런타임 코드, API 응답, 프론트 렌더링은 아직 바꾸지 않았다.
- `docs/current-state.md`는 현재 운영 truth 문서라 이번 draft 작업으로 수정하지 않았다.
- 기존 migration 파일은 수정하지 않고 새 draft migration 파일만 추가했다.

## Risks / Possible Regressions

- 이번 SQL 파일들은 아직 draft다. 그대로 실행 전에는 `recommendations` 중복 row 정리, RLS 의도, refresh 함수 성능을 한 번 더 검토해야 한다.
- `refresh_user_recommendation_profile()`는 현재 SQL만으로 텍스트를 보수적으로 정규화하므로, 이후 Python 계층의 job/skill normalizer와 연결되면 일부 해시 결과가 달라질 수 있다.
- `cowork/drafts/relevance-scoring-v2.md`와 이번 계약서는 방향은 같지만 적용 우선순위와 실제 source table이 일부 다르므로, 구현 시 이 문서를 최종 기준으로 삼아야 한다.

## Follow-up Refactoring Candidates

- `backend/routers/programs.py`의 `_build_profile_hash`, `_has_personalization_input`, `_compute_program_relevance_items`를 `user_recommendation_profile` 중심으로 재구성
- 추천/비교 관련 feature 추출을 `backend/rag/user_features.py` 같은 공용 모듈로 분리
- 대시보드 추천 BFF가 `Program` 객체에 `_reason`, `_fit_keywords`, `score`를 섞는 구조를 제거하고 `ProgramSurfaceContext`로 이관
- 장기적으로 `programs` 개편과 연결해 추천 카드도 `ProgramCardSummary + ProgramSurfaceContext`만 사용하도록 통합

