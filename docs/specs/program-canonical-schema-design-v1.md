# Program Canonical Schema Design v1

기준일: 2026-04-24  
상태: proposed  
범위: `program-surface-contract-v2` 기준 `programs / program_source_records / program_list_index` 최종 역할과 컬럼 설계

## 1. 문서 목적

이 문서는 프로그램 축 A와 화면 계약 축 B를 실제 DB 구조로 연결하기 위한 최종 스키마 설계서다.

이번 문서에서 고정하려는 핵심은 아래 3가지다.

1. `programs`는 서비스 정본 상세를 담당한다.
2. `program_source_records`는 raw/source provenance를 담당한다.
3. `program_list_index`는 카드형/테이블형 화면의 공용 summary projection을 담당한다.

## 2. 현재 저장소 기준으로 확인한 사실

아래는 이번 턴에서 실제 저장소를 읽고 확인한 사실이다.

- 현재 `public.programs`는 정본 상세와 raw/source 메타가 섞여 있다.
- 현재 `public.program_list_index`는 이미 운영 read-model로 쓰이고 있다.
- 현재 저장소에는 `program_source_records` 테이블이나 migration이 아직 없다.
- 현재 raw payload는 주로 `programs.raw_data`에 들어가고, field evidence 성격 데이터는 `compare_meta.field_sources` 쪽에 섞여 있다.
- 현재 목록/카드용 정렬 메타(`browse_rank`, `recommended_score`, `click_hotness_score`)는 `program_list_index`에 이미 존재한다.

중요:

- 위 5개는 확인된 사실이다.
- 아래 설계는 아직 proposed이며, 실제 DB에는 아직 반영되지 않았다.

## 3. 최상위 고정 원칙

- 프로그램 화면 계약 정본은 `program-surface-contract-v2.md`를 따른다.
- 카드형 화면은 `ProgramCardSummary`, 테이블형 목록은 `ProgramListRow`, 상세는 `ProgramDetailResponse`, 화면 문맥은 `ProgramSurfaceContext`다.
- 추천은 프로그램 정본 값을 덮어쓰지 않고 `context`만 붙인다.
- `program_list_index`는 카드/목록 summary projection만 담당하고, raw payload를 저장하지 않는다.
- `programs`는 상세 정본이므로 source raw, field evidence, source별 식별자 보관소가 되면 안 된다.
- `program_source_records`는 source provenance 저장소이므로 프론트 표시 계약을 직접 책임지지 않는다.

## 4. 최종 역할 분리

| 테이블 | 최종 역할 | 프론트/API에 직접 노출되는가 |
| --- | --- | --- |
| `programs` | 서비스 정본 상세 | 상세/비교에서 간접 노출 |
| `program_source_records` | raw payload, field evidence, source-specific 식별자 | 직접 노출하지 않음 |
| `program_list_index` | 카드형/테이블형 공용 summary projection | 목록/카드에서 직접 사용 |

## 5. 테이블별 최종 설계

## 5.1 `programs`

### 역할

- 서비스가 “이 프로그램을 어떻게 보여줄지”에 대한 정본 상세를 저장한다.
- 상세 화면과 비교 본문이 읽는 기준 테이블이다.
- raw 원문이나 source별 식별자는 직접 품지 않고, `program_source_records`를 참조한다.

### 최종 컬럼안

| 컬럼 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `id` | `uuid` | 예 | 프로그램 정본 id |
| `primary_source_record_id` | `uuid` | 아니오 | 대표 source record |
| `primary_source_code` | `text` | 예 | 기계용 source 코드 |
| `primary_source_label` | `text` | 예 | 사용자 표시용 source 이름 |
| `title` | `text` | 예 | 프로그램 제목 |
| `provider_name` | `text` | 아니오 | 운영 기관/제공 기관 |
| `organizer_name` | `text` | 아니오 | 주관 기관 |
| `summary_text` | `text` | 아니오 | 상세보다 짧은 대표 요약 |
| `description` | `text` | 아니오 | 상세 설명 본문 |
| `category` | `text` | 아니오 | 큰 카테고리 |
| `category_detail` | `text` | 아니오 | 세부 카테고리 |
| `business_type` | `text` | 아니오 | 사업 유형 |
| `region` | `text` | 아니오 | 시/도 수준 정규화 지역 |
| `region_detail` | `text` | 아니오 | 시군구 수준 보조 지역 |
| `location_text` | `text` | 아니오 | 사용자 표시용 장소 원문 |
| `application_start_date` | `date` | 아니오 | 모집 시작일 |
| `application_end_date` | `date` | 아니오 | 모집 마감일 |
| `program_start_date` | `date` | 아니오 | 교육/운영 시작일 |
| `program_end_date` | `date` | 아니오 | 교육/운영 종료일 |
| `deadline_confidence` | `text` | 예 | 모집 마감일 신뢰도 |
| `application_url` | `text` | 아니오 | 지원 링크 |
| `detail_url` | `text` | 아니오 | 상세 원문 링크 |
| `source_url` | `text` | 아니오 | source landing 링크 |
| `thumbnail_url` | `text` | 아니오 | 카드용 썸네일 |
| `fee_amount` | `integer` | 아니오 | 사용자 부담액/수강료 |
| `support_amount` | `integer` | 아니오 | 지원 금액 |
| `cost_type` | `text` | 아니오 | 비용 분류 |
| `support_type` | `text` | 아니오 | 지원 방식 |
| `teaching_method` | `text` | 아니오 | 온/오프라인/혼합 등 |
| `participation_time` | `text` | 아니오 | 풀타임/파트타임 등 |
| `target_summary` | `text[]` | 예 | 모집 대상 요약 |
| `target_detail` | `text` | 아니오 | 대상 상세 설명 |
| `eligibility_labels` | `text[]` | 예 | 자격 요건 badge용 |
| `selection_process_label` | `text` | 아니오 | 선발 절차 요약 |
| `contact_phone` | `text` | 아니오 | 문의 전화 |
| `contact_email` | `text` | 아니오 | 문의 이메일 |
| `capacity_total` | `integer` | 아니오 | 총 정원 |
| `capacity_current` | `integer` | 아니오 | 현재 남은 인원 또는 현재 모집 인원 |
| `rating_value` | `numeric` | 아니오 | 만족도/평점 정규화 값 |
| `review_count` | `integer` | 아니오 | 리뷰 수 |
| `tags` | `text[]` | 예 | 프로그램 태그 |
| `skills` | `text[]` | 예 | 프로그램 스킬/키워드 |
| `curriculum_items` | `text[]` | 예 | 커리큘럼 요약 |
| `certifications` | `text[]` | 예 | 자격증/수료 결과 |
| `service_meta` | `jsonb` | 예 | 정본 컬럼으로 끌어올리기 전 임시 보조 메타 |
| `created_at` | `timestamptz` | 예 | 생성 시각 |
| `updated_at` | `timestamptz` | 예 | 갱신 시각 |

### `programs`에서 빼야 하는 것

- `raw_data`
- source별 고유 식별자 전부
- source별 field evidence
- 화면 전용 정렬 점수와 browse rank
- 광고 노출 순서 같은 surface runtime 정책

즉, 현재 `programs`에 있는 `raw_data`, `source_unique_key`, `hrd_id`, 비대해진 `compare_meta`는 최종 구조상 `programs` 소유가 아니다.

## 5.2 `program_source_records`

### 역할

- source 원문, source별 식별자, field provenance를 저장한다.
- 한 `program_id`에 여러 source record가 붙을 수 있게 한다.
- collector/admin sync가 먼저 적재하는 진입점이 된다.

### 최종 컬럼안

| 컬럼 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `id` | `uuid` | 예 | source record id |
| `program_id` | `uuid` | 예 | 연결된 프로그램 정본 id |
| `source_code` | `text` | 예 | 기계용 source 코드 |
| `source_label` | `text` | 예 | 사용자 표시용 source 이름 |
| `source_family` | `text` | 아니오 | work24, kstartup 같은 계열 |
| `source_record_key` | `text` | 예 | source 내 고유 키 |
| `external_program_id` | `text` | 아니오 | `hrd_id` 등 원천 id |
| `source_url` | `text` | 아니오 | source landing 링크 |
| `detail_url` | `text` | 아니오 | source 상세 링크 |
| `application_url` | `text` | 아니오 | source 지원 링크 |
| `collect_method` | `text` | 아니오 | api/html/manual 등 수집 방식 |
| `raw_payload` | `jsonb` | 예 | 원문 payload |
| `normalized_snapshot` | `jsonb` | 예 | 이 source row가 정규화한 결과 snapshot |
| `field_evidence` | `jsonb` | 예 | 필드별 source evidence |
| `source_specific` | `jsonb` | 예 | 정본 컬럼으로 올리지 않은 source 전용 필드 |
| `is_primary` | `boolean` | 예 | 대표 source 여부 |
| `collected_at` | `timestamptz` | 아니오 | 수집 시각 |
| `last_seen_at` | `timestamptz` | 아니오 | 마지막 확인 시각 |
| `created_at` | `timestamptz` | 예 | 생성 시각 |
| `updated_at` | `timestamptz` | 예 | 갱신 시각 |

### 제약/인덱스 원칙

- `unique (source_code, source_record_key)`
- `index (program_id, source_code)`
- `partial unique (program_id) where is_primary = true`

### 현재 구조에서 이동되는 대표 데이터

| 현재 위치 | 최종 위치 |
| --- | --- |
| `programs.raw_data` | `program_source_records.raw_payload` |
| `programs.source_unique_key` | `program_source_records.source_record_key` |
| `programs.hrd_id` | `program_source_records.external_program_id` |
| `compare_meta.field_sources` | `program_source_records.field_evidence` |
| source별 잔여 메타 | `program_source_records.source_specific` |

## 5.3 `program_list_index`

### 역할

- `ProgramBaseSummary`, `ProgramCardSummary`, `ProgramListRow`를 한 번에 지원하는 projection이다.
- 카드형/테이블형이 필요한 표시 문구는 backend가 미리 완성해서 넣는다.
- 정렬/인기/광고/클릭 집계 같은 runtime 메타도 이 테이블에 둔다.

### 최종 컬럼안

| 컬럼 | 타입 | 필수 | 설명 |
| --- | --- | --- | --- |
| `id` | `uuid` | 예 | `programs.id`와 동일 |
| `title` | `text` | 예 | `ProgramBaseSummary.title` |
| `provider_name` | `text` | 아니오 | `ProgramBaseSummary.provider_name` |
| `source_code` | `text` | 예 | `ProgramBaseSummary.source_code` |
| `source_label` | `text` | 예 | `ProgramBaseSummary.source_label` |
| `summary_text` | `text` | 아니오 | `ProgramBaseSummary.summary_text` |
| `display_categories` | `text[]` | 예 | `ProgramBaseSummary.display_categories` |
| `region_label` | `text` | 아니오 | `ProgramBaseSummary.region_label` |
| `application_start_date` | `date` | 아니오 | 모집 시작일 |
| `application_end_date` | `date` | 아니오 | 모집 마감일 |
| `program_start_date` | `date` | 아니오 | 운영 시작일 |
| `program_end_date` | `date` | 아니오 | 운영 종료일 |
| `is_open` | `boolean` | 예 | 모집중 여부 |
| `recruiting_status` | `text` | 예 | `open/closing_soon/closed/unknown` |
| `recruiting_status_label` | `text` | 예 | 사용자 표시 문구 |
| `days_left` | `integer` | 아니오 | D-day 계산 값 |
| `deadline_confidence` | `text` | 예 | 마감일 신뢰도 |
| `primary_link` | `text` | 아니오 | `application_url -> detail_url -> source_url` 우선순위 결과 |
| `detail_path` | `text` | 예 | 상세 페이지 내부 경로 |
| `compare_path` | `text` | 예 | 비교 페이지 내부 경로 |
| `thumbnail_url` | `text` | 아니오 | 카드형 전용 시각 자산 |
| `location_label` | `text` | 아니오 | 화면 표시용 장소 |
| `program_period_label` | `text` | 아니오 | 운영 기간 문구 |
| `cost_label` | `text` | 예 | 비용 표시 문구 |
| `teaching_method_label` | `text` | 아니오 | 수업 방식 문구 |
| `participation_label` | `text` | 아니오 | 참여 시간 문구 |
| `selection_process_label` | `text` | 아니오 | 선발 절차 문구 |
| `keyword_labels` | `text[]` | 예 | 카드/목록 공용 키워드 |
| `badge_labels` | `text[]` | 예 | 비개인화 badge |
| `search_text` | `text` | 예 | 검색용 projection 텍스트 |
| `is_ad` | `boolean` | 예 | 광고/스폰서 여부 |
| `promoted_rank` | `integer` | 아니오 | 광고 노출 순서 |
| `browse_rank` | `integer` | 아니오 | 기본 browse pool 순서 |
| `recommended_score` | `numeric` | 예 | 비개인화 추천/품질 정렬용 점수 |
| `detail_view_count` | `bigint` | 예 | 상세 조회 누적 |
| `detail_view_count_7d` | `bigint` | 예 | 최근 7일 상세 조회 |
| `click_hotness_score` | `numeric` | 예 | 인기 정렬용 점수 |
| `last_detail_viewed_at` | `timestamptz` | 아니오 | 마지막 상세 조회 시각 |
| `updated_at` | `timestamptz` | 예 | 원본 기준 최신 갱신 시각 |
| `indexed_at` | `timestamptz` | 예 | projection 갱신 시각 |

### `program_list_index`에 두지 않을 것

- raw payload
- field evidence
- source별 긴 메타 JSON
- 사용자별 추천 점수
- 북마크 여부

즉, `ProgramSurfaceContext`는 `program_list_index` 정본 컬럼이 아니라 읽기 시점 합성 결과다.

## 6. 현재 컬럼과 최종 위치 매핑

| 현재 컬럼 | 최종 판단 |
| --- | --- |
| `programs.provider` | `programs.provider_name`로 정리 |
| `programs.location` | `programs.location_text`로 정리 |
| `programs.link` | `programs.detail_url`로 의미 고정 |
| `programs.deadline/close_date` | `application_end_date`로 통합하고 confidence 규칙 유지 |
| `programs.start_date/end_date` | `program_start_date/program_end_date`로 의미 고정 |
| `programs.raw_data` | `program_source_records.raw_payload`로 이동 |
| `programs.source_unique_key/hrd_id` | `program_source_records.source_record_key/external_program_id`로 이동 |
| `programs.compare_meta` | 정본 컬럼 + `programs.service_meta` + `program_source_records.field_evidence/source_specific`로 분해 |
| `program_list_index.compare_meta` | 최종 구조에서는 제거 대상 |
| `program_list_index.source` | `source_code + source_label` 2개 컬럼으로 분리 |
| `program_list_index.provider` | `provider_name`으로 명시화 |
| `program_list_index.summary` | `summary_text`로 명시화 |

## 7. 이 설계가 현재 계약에 주는 의미

- 카드형 화면은 최종적으로 `program_list_index`만 읽어도 `ProgramCardSummary`를 완성할 수 있어야 한다.
- 테이블형 목록도 `program_list_index`만 읽어 `ProgramListRow`를 완성할 수 있어야 한다.
- 상세/비교 본문은 `programs`를 읽고, 필요한 source-specific 보강만 `program_source_records`에서 가져와야 한다.
- 추천은 위 3개 테이블 어디에도 사용자별 값을 덮어쓰지 않고 읽기 시점에 `context`를 붙여야 한다.

## 8. 구현 시 주의할 점

- 현재 운영 `program_list_index`는 이미 쓰이고 있으므로, 새 구조는 반드시 additive migration으로 들어가야 한다.
- `program_source_records`가 생기기 전까지는 collector/admin sync가 `programs`에 직접 쓰고 있으므로 dual write 단계가 필요하다.
- `compare_meta`는 한 번에 지우지 말고 “정본 컬럼으로 승격 -> source record로 이동 -> 마지막 cleanup” 순서를 따라야 한다.

## 9. 이번 문서에서 고정하는 판단

- `programs`는 상세 정본이다.
- `program_source_records`는 provenance 정본이다.
- `program_list_index`는 화면 summary projection이다.
- raw/source evidence는 더 이상 `programs`나 `program_list_index`의 주 저장 책임이 아니다.
- 현재 `program_source_records`가 아직 없다는 사실 자체가 다음 migration 설계의 출발점이다.
