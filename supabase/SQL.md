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

## Table `bookmarks`

### Columns

| Name           | Type            | Constraints |
| -------------- | --------------- | ----------- |
| `id`         | `uuid`        | Primary     |
| `user_id`    | `uuid`        | Nullable    |
| `program_id` | `uuid`        | Nullable    |
| `created_at` | `timestamptz` | Nullable    |

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

## Table `program_bookmarks`

### Columns

| Name           | Type            | Constraints |
| -------------- | --------------- | ----------- |
| `user_id`    | `uuid`        | Primary     |
| `program_id` | `uuid`        | Primary     |
| `created_at` | `timestamptz` |             |

## Table `programs`

### Columns

| Name                  | Type            | Constraints     |
| --------------------- | --------------- | --------------- |
| `id`                | `uuid`        | Primary         |
| `hrd_id`            | `text`        | Nullable Unique |
| `title`             | `text`        |                 |
| `category`          | `text`        | Nullable        |
| `provider`          | `text`        | Nullable        |
| `location`          | `text`        | Nullable        |
| `start_date`        | `date`        | Nullable        |
| `end_date`          | `date`        | Nullable        |
| `deadline`          | `date`        | Nullable        |
| `cost`              | `int4`        | Nullable        |
| `subsidy_rate`      | `int4`        | Nullable        |
| `target`            | `_text`       | Nullable        |
| `description`       | `text`        | Nullable        |
| `source_url`        | `text`        | Nullable        |
| `is_active`         | `bool`        | Nullable        |
| `created_at`        | `timestamptz` | Nullable        |
| `updated_at`        | `timestamptz` | Nullable        |
| `subsidy_amount`    | `int4`        | Nullable        |
| `source`            | `text`        | Nullable        |
| `reg_start_date`    | `date`        | Nullable        |
| `close_date`        | `date`        | Nullable        |
| `job_type`          | `varchar`     | Nullable        |
| `source_type`       | `text`        |                 |
| `collection_method` | `text`        |                 |
| `scope`             | `text`        |                 |
| `region`            | `text`        | Nullable        |
| `region_detail`     | `text`        | Nullable        |
| `link`              | `text`        | Nullable        |
| `is_ad`             | `bool`        | Nullable        |
| `sponsor_name`      | `text`        | Nullable        |
| `compare_meta`      | `jsonb`       | Nullable        |
| `source_unique_key` | `text`        | Nullable        |
| `summary`           | `text`        | Nullable        |
| `tags`              | `_text`       | Nullable        |
| `skills`            | `_text`       | Nullable        |
| `search_text`       | `text`        | Nullable        |
| `support_type`      | `text`        | Nullable        |
| `teaching_method`   | `text`        | Nullable        |
| `is_certified`      | `bool`        |                 |
| `raw_data`          | `jsonb`       | Nullable        |
| `category_detail`   | `text`        | Nullable        |

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
