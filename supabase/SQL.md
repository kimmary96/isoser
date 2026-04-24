## SQL Snapshot Note

- 이 문서는 수동 스냅샷 성격의 참고 문서입니다.
- package-5 운영 판단의 최종 정본으로 쓰면 안 됩니다.
- 2026-04-24 live read-only 재확인 기준:
  - `program_list_index`, `program_source_records`, additive `programs` canonical 컬럼은 live DB에서 확인됐습니다.
  - `profiles.target_job/target_job_normalized`, `user_program_preferences`, `user_recommendation_profile`, `refresh_user_recommendation_profile(p_user_id uuid)`, `recommendations.query_hash/profile_hash/expires_at/fit_keywords`도 live DB에서 확인됐습니다.
  - `reports/program-validation-sample-latest.json` 기준 `free-plan-50` bounded sample validation은 `program_list_index` 50건, `program_source_records` 50건으로 성공했습니다.
  - 같은 날 운영 SQL Editor 확인에서 `public.bookmarks`는 `0` row / inbound 참조 없음 상태로 확인된 뒤 삭제됐고, 북마크 정본 테이블은 계속 `public.program_bookmarks`입니다.
- 현재 live migration apply 상태를 판정할 때는 이 문서보다 `supabase/README.md`와 `supabase_migrations.schema_migrations` 확인을 우선합니다.

## Table `activities`

### Columns

| Name                 | Type            | Constraints |
| -------------------- | --------------- | ----------- |
| `id`               | `uuid`        | Primary     |
| `user_id`          | `uuid`        | Nullable    |
| `type`             | `text`        |             |
| `title`            | `text`        |             |
| `period`           | `text`        | Nullable    |
| `role`             | `text`        | Nullable    |
| `skills`           | `_text`       | Nullable    |
| `description`      | `text`        | Nullable    |
| `is_visible`       | `bool`        | Nullable    |
| `created_at`       | `timestamptz` | Nullable    |
| `updated_at`       | `timestamptz` | Nullable    |
| `star_situation`   | `text`        | Nullable    |
| `star_task`        | `text`        | Nullable    |
| `star_action`      | `text`        | Nullable    |
| `star_result`      | `text`        | Nullable    |
| `organization`     | `text`        | Nullable    |
| `team_size`        | `int4`        | Nullable    |
| `team_composition` | `text`        | Nullable    |
| `my_role`          | `text`        | Nullable    |
| `contributions`    | `_text`       | Nullable    |
| `image_urls`       | `_text`       | Nullable    |

## Table `calendar_program_selections`

### Columns

| Name           | Type            | Constraints |
| -------------- | --------------- | ----------- |
| `id`         | `uuid`        | Primary     |
| `user_id`    | `uuid`        |             |
| `program_id` | `uuid`        |             |
| `position`   | `int4`        |             |
| `created_at` | `timestamptz` |             |
| `updated_at` | `timestamptz` |             |

## Table `coach_sessions`

### Columns

| Name            | Type            | Constraints |
| --------------- | --------------- | ----------- |
| `id`          | `uuid`        | Primary     |
| `user_id`     | `uuid`        | Nullable    |
| `activity_id` | `uuid`        | Nullable    |
| `messages`    | `jsonb`       | Nullable    |
| `created_at`  | `timestamptz` | Nullable    |
| `updated_at`  | `timestamptz` | Nullable    |

## Table `cover_letters`

### Columns

| Name                | Type            | Constraints |
| ------------------- | --------------- | ----------- |
| `id`              | `uuid`        | Primary     |
| `user_id`         | `uuid`        |             |
| `title`           | `text`        |             |
| `company_name`    | `text`        | Nullable    |
| `job_title`       | `text`        | Nullable    |
| `prompt_question` | `text`        | Nullable    |
| `content`         | `text`        |             |
| `tags`            | `_text`       | Nullable    |
| `qa_items`        | `jsonb`       |             |
| `created_at`      | `timestamptz` |             |
| `updated_at`      | `timestamptz` |             |

## Table `cowork_approvals`

### Columns

| Name                 | Type            | Constraints     |
| -------------------- | --------------- | --------------- |
| `task_id`          | `text`        | Primary         |
| `target`           | `text`        |                 |
| `approved_by`      | `text`        |                 |
| `approved_by_name` | `text`        | Nullable        |
| `approved_at`      | `timestamptz` |                 |
| `source`           | `text`        |                 |
| `state`            | `text`        |                 |
| `consumed_at`      | `timestamptz` | Nullable        |
| `consumed_by`      | `text`        | Nullable        |
| `consume_note`     | `text`        | Nullable        |
| `created_at`       | `timestamptz` |                 |
| `updated_at`       | `timestamptz` |                 |
| `slack_message_ts` | `text`        | Nullable        |
| `slack_channel_id` | `text`        | Nullable        |
| `id`               | `int8`        | Unique Identity |
| `claimed_at`       | `timestamptz` | Nullable        |
| `claimed_by`       | `text`        | Nullable        |

## Table `match_analyses`

### Columns

| Name                       | Type            | Constraints |
| -------------------------- | --------------- | ----------- |
| `id`                     | `uuid`        | Primary     |
| `user_id`                | `uuid`        |             |
| `job_title`              | `text`        | Nullable    |
| `job_posting`            | `text`        |             |
| `total_score`            | `int4`        |             |
| `grade`                  | `text`        |             |
| `summary`                | `text`        |             |
| `matched_keywords`       | `_text`       | Nullable    |
| `missing_keywords`       | `_text`       | Nullable    |
| `recommended_activities` | `_text`       | Nullable    |
| `analysis_payload`       | `jsonb`       | Nullable    |
| `created_at`             | `timestamptz` |             |

## Table `portfolios`

### Columns

| Name                      | Type            | Constraints |
| ------------------------- | --------------- | ----------- |
| `id`                    | `uuid`        | Primary     |
| `user_id`               | `uuid`        | Nullable    |
| `title`                 | `text`        |             |
| `description`           | `text`        | Nullable    |
| `template_id`           | `text`        | Nullable    |
| `selected_activity_ids` | `_uuid`       | Nullable    |
| `thumbnail_url`         | `text`        | Nullable    |
| `is_public`             | `bool`        | Nullable    |
| `created_at`            | `timestamptz` | Nullable    |
| `updated_at`            | `timestamptz` | Nullable    |
| `source_activity_id`    | `uuid`        | Nullable    |
| `portfolio_payload`     | `jsonb`       | Nullable    |

## Table `profiles`

### Columns

| Name                  | Type            | Constraints |
| --------------------- | --------------- | ----------- |
| `id`                | `uuid`        | Primary     |
| `name`              | `text`        | Nullable    |
| `email`             | `text`        | Nullable    |
| `phone`             | `text`        | Nullable    |
| `education`         | `text`        | Nullable    |
| `created_at`        | `timestamptz` | Nullable    |
| `updated_at`        | `timestamptz` | Nullable    |
| `career`            | `_text`       | Nullable    |
| `education_history` | `_text`       | Nullable    |
| `awards`            | `_text`       | Nullable    |
| `certifications`    | `_text`       | Nullable    |
| `languages`         | `_text`       | Nullable    |
| `skills`            | `_text`       | Nullable    |
| `self_intro`        | `text`        | Nullable    |
| `avatar_url`        | `text`        | Nullable    |
| `bio`               | `text`        | Nullable    |
| `portfolio_url`     | `text`        | Nullable    |
| `address`           | `text`        | Nullable    |
| `region`            | `text`        | Nullable    |
| `region_detail`     | `text`        | Nullable    |
| `target_job`        | `text`        | Nullable    |
| `target_job_normalized` | `text`    | Nullable    |

## Table `program_bookmarks`

### Columns

| Name           | Type            | Constraints |
| -------------- | --------------- | ----------- |
| `user_id`    | `uuid`        | Primary     |
| `program_id` | `uuid`        | Primary     |
| `created_at` | `timestamptz` |             |

## Table `program_detail_daily_stats`

### Columns

| Name               | Type            | Constraints |
| ------------------ | --------------- | ----------- |
| `program_id`     | `uuid`        | Primary     |
| `bucket_date`    | `date`        | Primary     |
| `view_count`     | `int8`        |             |
| `last_viewed_at` | `timestamptz` |             |
| `created_at`     | `timestamptz` |             |
| `updated_at`     | `timestamptz` |             |

## Table `program_list_facet_snapshots`

### Columns

| Name             | Type            | Constraints |
| ---------------- | --------------- | ----------- |
| `id`           | `int8`        | Primary     |
| `scope`        | `text`        |             |
| `pool_limit`   | `int4`        |             |
| `facets`       | `jsonb`       |             |
| `generated_at` | `timestamptz` |             |

## Table `program_list_index`

### Columns

| Name                         | Type            | Constraints |
| ---------------------------- | --------------- | ----------- |
| `id`                       | `uuid`        | Primary     |
| `title`                    | `text`        | Nullable    |
| `provider`                 | `text`        | Nullable    |
| `summary`                  | `text`        | Nullable    |
| `category`                 | `text`        | Nullable    |
| `category_detail`          | `text`        | Nullable    |
| `region`                   | `text`        | Nullable    |
| `region_detail`            | `text`        | Nullable    |
| `location`                 | `text`        | Nullable    |
| `teaching_method`          | `text`        | Nullable    |
| `cost`                     | `int4`        | Nullable    |
| `cost_type`                | `text`        | Nullable    |
| `participation_time`       | `text`        | Nullable    |
| `source`                   | `text`        | Nullable    |
| `source_url`               | `text`        | Nullable    |
| `link`                     | `text`        | Nullable    |
| `thumbnail_url`            | `text`        | Nullable    |
| `deadline`                 | `date`        | Nullable    |
| `close_date`               | `date`        | Nullable    |
| `start_date`               | `date`        | Nullable    |
| `end_date`                 | `date`        | Nullable    |
| `is_open`                  | `bool`        |             |
| `is_active`                | `bool`        | Nullable    |
| `is_ad`                    | `bool`        |             |
| `promoted_rank`            | `int4`        | Nullable    |
| `deadline_confidence`      | `text`        |             |
| `excellence_score`         | `numeric`     |             |
| `satisfaction_avg`         | `numeric`     | Nullable    |
| `satisfaction_count`       | `int4`        |             |
| `bayesian_satisfaction`    | `numeric`     |             |
| `review_confidence`        | `numeric`     |             |
| `deadline_urgency`         | `numeric`     |             |
| `freshness_score`          | `numeric`     |             |
| `data_completeness`        | `numeric`     |             |
| `recommended_score`        | `numeric`     |             |
| `recommendation_reasons`   | `_text`       |             |
| `display_categories`       | `_text`       |             |
| `participation_mode_label` | `text`        | Nullable    |
| `participation_time_text`  | `text`        | Nullable    |
| `selection_process_label`  | `text`        | Nullable    |
| `extracted_keywords`       | `_text`       |             |
| `tags`                     | `_text`       |             |
| `skills`                   | `_text`       |             |
| `target_summary`           | `_text`       |             |
| `compare_meta`             | `jsonb`       |             |
| `search_text`              | `text`        |             |
| `days_left`                | `int4`        | Nullable    |
| `browse_rank`              | `int4`        | Nullable    |
| `updated_at`               | `timestamptz` |             |
| `indexed_at`               | `timestamptz` |             |
| `detail_view_count`        | `int8`        |             |
| `detail_view_count_7d`     | `int8`        |             |
| `click_hotness_score`      | `numeric`     |             |
| `last_detail_viewed_at`    | `timestamptz` | Nullable    |
| `provider_name`            | `text`        | Nullable    |
| `source_code`              | `text`        | Nullable    |
| `source_label`             | `text`        | Nullable    |
| `summary_text`             | `text`        | Nullable    |
| `region_label`             | `text`        | Nullable    |
| `application_start_date`   | `date`        | Nullable    |
| `application_end_date`     | `date`        | Nullable    |
| `program_start_date`       | `date`        | Nullable    |
| `program_end_date`         | `date`        | Nullable    |
| `recruiting_status`        | `text`        |             |
| `recruiting_status_label`  | `text`        |             |
| `primary_link`             | `text`        | Nullable    |
| `detail_path`              | `text`        |             |
| `compare_path`             | `text`        |             |
| `location_label`           | `text`        | Nullable    |
| `program_period_label`     | `text`        | Nullable    |
| `cost_label`               | `text`        |             |
| `teaching_method_label`    | `text`        | Nullable    |
| `participation_label`      | `text`        | Nullable    |
| `keyword_labels`           | `_text`       |             |
| `badge_labels`             | `_text`       |             |

## Table `program_source_records`

프로그램 원천 raw payload, source-specific 식별자, field evidence를 저장하는 provenance 정본

### Columns

| Name                    | Type            | Constraints |
| ----------------------- | --------------- | ----------- |
| `id`                  | `uuid`        | Primary     |
| `program_id`          | `uuid`        |             |
| `source_code`         | `text`        |             |
| `source_label`        | `text`        |             |
| `source_family`       | `text`        | Nullable    |
| `source_record_key`   | `text`        |             |
| `external_program_id` | `text`        | Nullable    |
| `source_url`          | `text`        | Nullable    |
| `detail_url`          | `text`        | Nullable    |
| `application_url`     | `text`        | Nullable    |
| `collect_method`      | `text`        | Nullable    |
| `raw_payload`         | `jsonb`       |             |
| `normalized_snapshot` | `jsonb`       |             |
| `field_evidence`      | `jsonb`       |             |
| `source_specific`     | `jsonb`       |             |
| `is_primary`          | `bool`        |             |
| `collected_at`        | `timestamptz` | Nullable    |
| `last_seen_at`        | `timestamptz` | Nullable    |
| `created_at`          | `timestamptz` |             |
| `updated_at`          | `timestamptz` |             |

## Table `programs`

### Columns

| Name                         | Type            | Constraints |
| ---------------------------- | --------------- | ----------- |
| `id`                       | `uuid`        | Primary     |
| `hrd_id`                   | `text`        | Nullable    |
| `title`                    | `text`        |             |
| `category`                 | `text`        | Nullable    |
| `provider`                 | `text`        | Nullable    |
| `location`                 | `text`        | Nullable    |
| `start_date`               | `date`        | Nullable    |
| `end_date`                 | `date`        | Nullable    |
| `deadline`                 | `date`        | Nullable    |
| `cost`                     | `int4`        | Nullable    |
| `subsidy_rate`             | `int4`        | Nullable    |
| `target`                   | `_text`       | Nullable    |
| `description`              | `text`        | Nullable    |
| `source_url`               | `text`        | Nullable    |
| `is_active`                | `bool`        | Nullable    |
| `created_at`               | `timestamptz` | Nullable    |
| `updated_at`               | `timestamptz` | Nullable    |
| `subsidy_amount`           | `int4`        | Nullable    |
| `source`                   | `text`        | Nullable    |
| `reg_start_date`           | `date`        | Nullable    |
| `close_date`               | `date`        | Nullable    |
| `job_type`                 | `varchar`     | Nullable    |
| `source_type`              | `text`        |             |
| `collection_method`        | `text`        |             |
| `scope`                    | `text`        |             |
| `region`                   | `text`        | Nullable    |
| `region_detail`            | `text`        | Nullable    |
| `link`                     | `text`        | Nullable    |
| `is_ad`                    | `bool`        | Nullable    |
| `sponsor_name`             | `text`        | Nullable    |
| `compare_meta`             | `jsonb`       | Nullable    |
| `source_unique_key`        | `text`        | Nullable    |
| `summary`                  | `text`        | Nullable    |
| `tags`                     | `_text`       | Nullable    |
| `skills`                   | `_text`       | Nullable    |
| `search_text`              | `text`        | Nullable    |
| `support_type`             | `text`        | Nullable    |
| `teaching_method`          | `text`        | Nullable    |
| `is_certified`             | `bool`        |             |
| `raw_data`                 | `jsonb`       | Nullable    |
| `category_detail`          | `text`        | Nullable    |
| `thumbnail_url`            | `text`        | Nullable    |
| `cost_type`                | `text`        | Nullable    |
| `participation_time`       | `text`        | Nullable    |
| `primary_source_record_id` | `uuid`        | Nullable    |
| `primary_source_code`      | `text`        | Nullable    |
| `primary_source_label`     | `text`        | Nullable    |
| `provider_name`            | `text`        | Nullable    |
| `organizer_name`           | `text`        | Nullable    |
| `summary_text`             | `text`        | Nullable    |
| `business_type`            | `text`        | Nullable    |
| `location_text`            | `text`        | Nullable    |
| `application_start_date`   | `date`        | Nullable    |
| `application_end_date`     | `date`        | Nullable    |
| `program_start_date`       | `date`        | Nullable    |
| `program_end_date`         | `date`        | Nullable    |
| `deadline_confidence`      | `text`        |             |
| `detail_url`               | `text`        | Nullable    |
| `fee_amount`               | `int4`        | Nullable    |
| `support_amount`           | `int4`        | Nullable    |
| `target_summary`           | `_text`       |             |
| `target_detail`            | `text`        | Nullable    |
| `eligibility_labels`       | `_text`       |             |
| `selection_process_label`  | `text`        | Nullable    |
| `contact_phone`            | `text`        | Nullable    |
| `contact_email`            | `text`        | Nullable    |
| `capacity_total`           | `int4`        | Nullable    |
| `capacity_current`         | `int4`        | Nullable    |
| `rating_value`             | `numeric`     | Nullable    |
| `curriculum_items`         | `_text`       |             |
| `certifications`           | `_text`       |             |
| `service_meta`             | `jsonb`       |             |

## Table `recommendations`

### Columns

| Name                 | Type            | Constraints |
| -------------------- | --------------- | ----------- |
| `id`               | `uuid`        | Primary     |
| `user_id`          | `uuid`        | Nullable    |
| `program_id`       | `uuid`        | Nullable    |
| `score`            | `float8`      | Nullable    |
| `reason`           | `text`        | Nullable    |
| `created_at`       | `timestamptz` | Nullable    |
| `similarity_score` | `float8`      | Nullable    |
| `relevance_score`  | `float8`      | Nullable    |
| `urgency_score`    | `float8`      | Nullable    |
| `final_score`      | `float8`      | Nullable    |
| `generated_at`     | `timestamptz` | Nullable    |
| `query_hash`       | `text`        | Nullable    |
| `profile_hash`     | `text`        | Nullable    |
| `expires_at`       | `timestamptz` | Nullable    |
| `fit_keywords`     | `_text`       | Nullable    |

## Table `user_program_preferences`

### Columns

| Name                          | Type            | Constraints |
| ----------------------------- | --------------- | ----------- |
| `user_id`                     | `uuid`          | Primary     |
| `target_job`                  | `text`          | Nullable    |
| `target_job_normalized`       | `text`          | Nullable    |
| `preferred_regions`           | `_text`         |             |
| `preferred_region_details`    | `_text`         |             |
| `preferred_categories`        | `_text`         |             |
| `preferred_teaching_methods`  | `_text`         |             |
| `preferred_participation_times` | `_text`       |             |
| `preferred_cost_types`        | `_text`         |             |
| `desired_skills`              | `_text`         |             |
| `remote_ok`                   | `bool`          | Nullable    |
| `max_cost`                    | `int4`          | Nullable    |
| `created_at`                  | `timestamptz`   |             |
| `updated_at`                  | `timestamptz`   |             |

## Table `user_recommendation_profile`

### Columns

| Name                            | Type            | Constraints |
| ------------------------------- | --------------- | ----------- |
| `user_id`                       | `uuid`          | Primary     |
| `effective_target_job`          | `text`          | Nullable    |
| `effective_target_job_normalized` | `text`        | Nullable    |
| `profile_keywords`              | `_text`         |             |
| `evidence_skills`               | `_text`         |             |
| `desired_skills`                | `_text`         |             |
| `activity_keywords`             | `_text`         |             |
| `preferred_regions`             | `_text`         |             |
| `profile_completeness_score`    | `numeric`       |             |
| `recommendation_ready`          | `bool`          |             |
| `recommendation_profile_hash`   | `text`          |             |
| `derivation_version`            | `int4`          |             |
| `source_snapshot`               | `jsonb`         |             |
| `created_at`                    | `timestamptz`   |             |
| `updated_at`                    | `timestamptz`   |             |
| `last_derived_at`               | `timestamptz`   |             |

## Table `resumes`

### Columns

| Name                      | Type            | Constraints |
| ------------------------- | --------------- | ----------- |
| `id`                    | `uuid`        | Primary     |
| `user_id`               | `uuid`        | Nullable    |
| `title`                 | `text`        |             |
| `target_job`            | `text`        | Nullable    |
| `template_id`           | `text`        | Nullable    |
| `selected_activity_ids` | `_uuid`       | Nullable    |
| `created_at`            | `timestamptz` | Nullable    |
| `updated_at`            | `timestamptz` | Nullable    |
