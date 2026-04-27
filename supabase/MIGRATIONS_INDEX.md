# Supabase Migration Index

`supabase/migrations/`는 Supabase migration runner가 읽는 정본 이력 폴더입니다.
이미 적용된 migration을 날짜 폴더로 옮기거나 archive로 이동하면, 이후 reset, diff, 이력 대조, 신규 환경 부트스트랩이 깨질 수 있습니다.

따라서 이 저장소에서는:

- `supabase/migrations/` 안의 SQL 파일은 평면(flat) 구조로 유지합니다.
- 찾기 문제는 이 인덱스 문서에서 해결합니다.
- 실행 대상이 아닌 초안 SQL은 `supabase/SQL.md`나 관련 specs 문서에 둡니다.

## Quick Rules

- 새 migration 파일명은 `YYYYMMDDHHMMSS_description.sql` 형식을 사용합니다.
- 이미 적용된 migration은 수정/이동하지 않습니다.
- 보정이 필요하면 새 corrective migration을 추가합니다.
- live 적용 여부의 최종 정본은 `supabase_migrations.schema_migrations`입니다.

## Legacy Bootstrap

초기 부트스트랩/구형 스키마 흔적입니다. 현재 계약과 직접 충돌할 수 있으므로 수정하지 말고 참고만 합니다.

- `001_init_schema.sql`
- `002_add_bio_to_profiles.sql`
- `003_create_cover_letters.sql`
- `004_add_qa_items_to_cover_letters.sql`
- `20260403093000_create_coach_sessions.sql`
- `20260408113000_add_portfolio_url_to_profiles.sql`
- `20260410120000_create_programs_and_bookmarks.sql`
- `20260410133000_add_work24_sync_columns_to_programs.sql`

## 2026-04-15

추천/프로그램/협업 승인 기본 축을 만든 날입니다.

- `20260415_create_programs.sql`
- `20260415_create_recommendations.sql`
- `20260415113000_add_compare_meta_to_programs.sql`
- `20260415170000_add_programs_hub_fields.sql`
- `20260415183000_create_cowork_approvals.sql`
- `20260415191000_add_slack_thread_fields_to_cowork_approvals.sql`
- `20260415213000_harden_cowork_approvals.sql`

## 2026-04-16

추천 cache/규칙 쪽 corrective migration 묶음입니다.

- `20260416113000_add_relevance_score_to_recommendations.sql`
- `20260416120000_expand_recommendations_cache_columns.sql`
- `20260416121000_create_recommendation_rules.sql`
- `20260416132000_fix_recommendations_cache_contract.sql`

## 2026-04-21

캘린더/포트폴리오 persistence 추가입니다.

- `20260421160000_add_calendar_and_portfolio_persistence.sql`

## 2026-04-22

프로그램 검색/필터/고유키 기반 정리 시작점입니다.

- `20260422190000_add_programs_source_unique_key.sql`
- `20260422201000_fix_programs_source_unique_key_conflict_index.sql`
- `20260422203000_add_programs_search_text_index.sql`
- `20260422212000_add_programs_category_detail.sql`
- `20260422213000_add_programs_cost_time_filters.sql`

## 2026-04-23

프로그램 read-model, browse 품질, Work24 표시 보정이 집중된 묶음입니다.

- `20260423100000_add_address_to_profiles.sql`
- `20260423112000_refine_programs_search_metadata.sql`
- `20260423123000_align_recommendations_cache_schema.sql`
- `20260423143000_relax_programs_legacy_unique_constraints.sql`
- `20260423170000_add_program_list_read_model.sql`
- `20260423191000_program_list_read_model_runtime_indexes.sql`
- `20260423192000_optimize_program_list_refresh.sql`
- `20260423193000_enable_program_list_read_model_rls.sql`
- `20260423194000_harden_program_functions_search_path.sql`
- `20260423195000_improve_program_list_browse_pool_quality.sql`
- `20260423200000_move_pg_trgm_extension_schema.sql`
- `20260423201000_add_cowork_approvals_service_role_policy.sql`
- `20260423203000_conservative_program_participation_display.sql`
- `20260423204000_add_program_list_browse_refresh_fallback.sql`
- `20260423205500_add_program_list_delta_refresh.sql`

## 2026-04-24

프로그램 상세 인기 지표, user recommendation additive schema, canonical/provenance, bounded helper, policy corrective migration 묶음입니다.

### Program detail / click hotness
- `20260424110000_add_program_detail_click_hotness.sql`

### User recommendation additive
- `20260425103000_add_profiles_target_job_columns.sql`
- `20260425104000_create_user_program_preferences.sql`
- `20260425105000_create_user_recommendation_profile.sql`
- `20260425110000_create_user_recommendation_profile_refresh_function.sql`
- `20260425111000_backfill_user_recommendation_inputs.sql`
- `20260425112000_align_recommendations_with_user_recommendation_profile.sql`

### Program canonical / provenance
- `20260425113000_create_program_source_records.sql`
- `20260425114000_add_program_canonical_columns.sql`
- `20260425115000_backfill_program_source_records_from_programs.sql`
- `20260425116000_backfill_program_canonical_fields.sql`
- `20260425117000_extend_program_list_index_surface_contract.sql`

### Bounded sample helpers
- `20260425118000_add_program_list_sample_refresh_helper.sql`
- `20260425119000_add_program_source_records_sample_backfill_helper.sql`

### Security / policy corrective
- `20260425120000_harden_remaining_function_search_paths.sql`
- `20260425121000_align_activity_images_storage_policies.sql`

## Where To Add New SQL

- 실제 실행할 migration: `supabase/migrations/`
- 운영 점검 SQL 메모: `supabase/SQL.md`
- 설계/검토 문서: `docs/specs/`

## Do Not Do

- 적용된 migration 파일 이동
- 적용된 migration 파일 이름 변경
- 날짜 폴더로 분산
- 기존 migration 본문 덮어쓰기
