# SESSION-2026-04-24 Program Canonical SQL Drafts Result

## Changed Files

- `supabase/migrations/20260425113000_create_program_source_records.sql`
- `supabase/migrations/20260425114000_add_program_canonical_columns.sql`
- `supabase/migrations/20260425115000_backfill_program_source_records_from_programs.sql`
- `supabase/migrations/20260425116000_backfill_program_canonical_fields.sql`
- `supabase/migrations/20260425117000_extend_program_list_index_surface_contract.sql`
- `docs/refactoring-log.md`
- `reports\session\2026-04\SESSION-2026-04-24-program-canonical-sql-drafts-result.md`

## Why Changes Were Made

- 지난 턴에서 정리한 프로그램 canonical/provenance 설계와 통합 migration 로드맵을 실제 실행 가능한 다음 단계로 내리기 위해 패키지 2 draft SQL 체인을 추가했다.
- 현재 저장소는 `program_list_index`는 이미 운영 중이지만 `program_source_records`는 아직 없어, provenance 분리와 canonical 컬럼 additive가 다음 구현의 선행 조건이었다.
- 추천 축과 다시 만날 수 있도록 `program_list_index`가 `program-surface-contract-v2`의 summary 구조를 직접 채울 준비도 함께 해둘 필요가 있었다.
- 실제 Supabase SQL Editor 검증 중 일부 DB 환경에서 `programs.application_url` legacy 컬럼이 없다는 drift가 확인되어, 3/4/5단계 draft가 해당 컬럼을 직접 참조하지 않도록 보강할 필요가 있었다.
- 추가 검증 중 일부 `programs.compare_meta` 값이 JSON object가 아니라 scalar라서 `- 'field_sources'` 연산이 실패하는 drift도 확인되어, 3/4단계 draft가 object 여부를 먼저 검사하도록 보강했다.
- 샘플 `program_list_index` 50건 재생성 검증에서는 `application_end_date`가 2026-01-25, 2026-04-23처럼 현재 날짜(2026-04-24)보다 과거여도 `recruiting_status`가 `open/closing_soon`으로 남는 문제가 확인되어, 5단계 계산이 canonical 모집 마감일을 우선하도록 수정이 필요했다.
- 같은 검증에서 4단계 `summary_text`가 `summary`만 보고 `description`을 fallback하지 않아 `summary_filled = 0`이 된 것도 확인되어, `description` 280자 fallback을 추가했다.
- 샘플 100건 재확인에서는 `2026-04-23` 마감 row가 한국 시간 기준 `2026-04-24`에도 `closing_soon`으로 남아, DB 세션 날짜가 UTC `2026-04-23`일 가능성이 드러났다. 이에 모집 상태 함수의 기준일을 `timezone('Asia/Seoul', now())::date`로 고정했다.

## Preserved Behaviors

- 현재 런타임 코드, API 응답, 운영 DB 동작은 바꾸지 않았다.
- 기존 migration 파일은 수정하지 않고 새 draft migration만 추가했다.
- `docs/current-state.md`와 `supabase/README.md`는 아직 운영 truth나 확정 체인이 아니므로 이번 draft 추가만으로 갱신하지 않았다.

## Risks / Possible Regressions

- 이 SQL들은 아직 draft다. 그대로 적용 전에는 trigger 비용, backfill 양, `program_list_index` refresh와의 상호작용을 한 번 더 검토해야 한다.
- `20260425117000_extend_program_list_index_surface_contract.sql`의 trigger 방식은 transition 기간을 위한 보수적 초안이라, 최종 구현에서는 refresh 함수 내부 projection으로 흡수하는 편이 더 나을 수 있다.
- `compare_meta`와 `raw_data`를 아직 유지한 채 새 컬럼을 채우는 구조이므로, cleanup 이전까지는 legacy/new 혼합 상태가 남는다.
- `application_url`는 문서상 legacy 컬럼이지만 실제 DB마다 존재 여부가 다를 수 있어, 이후 추가 draft에서도 optional legacy 필드는 직접 컬럼 참조보다 row JSON 접근을 우선해야 한다.
- `compare_meta`도 object라고 단정할 수 없으므로, 이후 migration/함수 초안은 JSON key 제거 전에 `jsonb_typeof(...) = 'object'` 검사를 기본으로 넣는 편이 안전하다.
- 모집 상태처럼 legacy 계산값(`is_open`, `days_left`)과 canonical 날짜(`application_end_date`)가 같이 있을 때는 canonical 값을 먼저 신뢰해야 한다. 그렇지 않으면 이미 지난 날짜도 모집중으로 남을 수 있다.
- 날짜 비교가 사용자-facing 상태에 직접 영향을 주는 경우에는 DB 세션 기본 timezone을 그대로 믿지 말고, 서비스 기준 timezone을 명시해야 한다. 이 프로젝트는 한국 사용자 대상이므로 KST 기준 비교가 더 안전하다.

## Follow-up Refactoring Candidates

- `backend/routers/admin.py` ingest path를 `program_source_records` dual write 기준으로 전환
- `refresh_program_list_delta`, `refresh_program_list_browse_pool` 내부 projection을 새 summary 컬럼 기준으로 직접 재작성
- `backend/routers/programs.py` serializer를 `ProgramCardSummary / ProgramListRow / ProgramDetailResponse` 기준으로 분리
- 이후 `programs.raw_data`, `programs.source_unique_key`, `program_list_index.compare_meta` cleanup migration 설계

