# Final Refactor Migration Roadmap v1

기준일: 2026-04-24  
상태: proposed  
범위: A/B/C/D/F 메인 축 기준 통합 migration 로드맵

## 1. 문서 목적

이 문서는 이미 고정된 스펙들을 실제 적용 순서로 묶은 통합 migration 로드맵이다.

이번 문서의 목표는 아래 4가지다.

1. 사용자 추천 축 선반영 결과와 프로그램 축 개편을 한 체인으로 묶는다.
2. `add -> backfill -> dual write -> read switch -> cleanup` 순서를 명확히 고정한다.
3. 문서, migration, backend switch, BFF switch가 서로 어긋나지 않게 한다.
4. rollback과 validate 지점을 단계별로 미리 정리한다.

## 2. 현재 저장소 기준으로 확인한 출발점

- 사용자 추천 축의 draft migration은 이미 `20260425103000` ~ `20260425112000`까지 내려와 있다.
- `program_list_index`는 이미 운영 read-model로 사용 중이다.
- `program_source_records`는 아직 없다.
- `programs`는 아직 raw/source 혼합 구조다.
- `docs/specs/program-surface-contract-v2.md`, `docs/specs/user-recommendation-serializer-contract-v1.md`, `docs/specs/final-refactor-axis-map-v1.md`는 이미 상위 계약으로 고정돼 있다.

## 3. 전체 패키지 순서

| 패키지 | 목적 | 상태 |
| --- | --- | --- |
| 패키지 0 | 계약 고정 | 완료 |
| 패키지 1 | 사용자 추천 정본 additive migration | draft 완료 |
| 패키지 2 | 프로그램 정본/provenance additive migration | 이번 문서 이후 설계 |
| 패키지 3 | dual write / dual refresh | 설계 필요 |
| 패키지 4 | serializer / API / BFF read switch | 설계 필요 |
| 패키지 5 | cleanup / validation / 문서 정합성 | 설계 필요 |

## 4. 단계별 로드맵

## 4.1 패키지 1: 사용자 추천 정본 additive

### 이미 있는 초안

- `20260425103000_add_profiles_target_job_columns.sql`
- `20260425104000_create_user_program_preferences.sql`
- `20260425105000_create_user_recommendation_profile.sql`
- `20260425110000_create_user_recommendation_profile_refresh_function.sql`
- `20260425111000_backfill_user_recommendation_inputs.sql`
- `20260425112000_align_recommendations_with_user_recommendation_profile.sql`

### 이 단계의 목적

- `bio`와 희망 직무를 분리한다.
- 추천 입력 정본을 `user_recommendation_profile`로 고정한다.
- recommendation cache contract를 코드 기대값에 맞춘다.

### 이 단계가 끝나면 보장돼야 하는 것

- `profiles.target_job`가 존재한다.
- `user_program_preferences`가 존재한다.
- `user_recommendation_profile`가 존재한다.
- `recommendations`가 `query_hash + profile_hash + expires_at + fit_keywords` 계약을 가진다.

## 4.2 패키지 2: 프로그램 정본/provenance additive

### 권장 migration 묶음

- `20260425113000_create_program_source_records.sql`
- `20260425114000_add_program_canonical_columns.sql`
- `20260425115000_backfill_program_source_records_from_programs.sql`
- `20260425116000_backfill_program_canonical_fields.sql`
- `20260425117000_extend_program_list_index_surface_contract.sql`

### 이 단계의 목적

- `program_source_records`를 신설한다.
- `programs`에 최종 canonical 컬럼을 additive로 추가한다.
- `program_list_index`에 `ProgramBaseSummary / Card / Row` 완성용 명시 컬럼을 additive로 추가한다.

### 이 단계에서 아직 하지 않을 것

- 기존 `programs.raw_data`, `programs.source_unique_key`, `program_list_index.compare_meta` 즉시 삭제
- 기존 ingest path 즉시 교체

## 4.3 패키지 3: backfill + dual write

### 목적

- 현재 운영/초안 구조와 최종 구조를 안전하게 같이 굴린다.

### 해야 할 일

1. 기존 `programs.raw_data`와 `compare_meta.field_sources`를 `program_source_records`로 backfill  
2. 기존 `programs` 컬럼에서 canonical 값만 골라 새 정본 컬럼으로 backfill  
3. `refresh_program_list_index()`가 legacy 컬럼과 새 canonical 컬럼을 함께 읽을 수 있게 보정  
4. admin/collector sync가 한동안은 legacy + new 구조를 같이 쓰는 dual write로 전환  
5. profile/resume/activity write 이후 `refresh_user_recommendation_profile()`를 공통 연결

### 핵심 판단

- 프로그램 축과 사용자 추천 축 모두 “한 번에 read switch”가 아니라 “먼저 새 구조를 채우고, 그 다음 read를 옮긴다”가 맞다.

## 4.4 패키지 4: read switch

### backend

1. 추천/비교 read를 raw profile에서 `user_recommendation_profile`로 전환  
2. 목록/card read를 `program_list_index` 명시 컬럼 serializer로 전환  
3. 상세 read를 `programs + program_source_records` 조합으로 전환

### BFF

1. 대시보드 추천 BFF  
2. 북마크/캘린더 BFF  
3. landing/live board/opportunity BFF 또는 helper  
4. 메인 목록 BFF  
5. 상세/비교 BFF

### frontend

1. `Program` monolith 타입 축소  
2. `ProgramCardItem`, `ProgramListRowItem`, `ProgramDetailResponse`, `ProgramCompareItem` 전환  
3. 추천 관련 값은 `context`로만 소비

## 4.5 패키지 5: cleanup / validation / 문서 정합성

### cleanup 대상

- `programs.raw_data`
- `programs.source_unique_key`
- `programs.hrd_id`
- `program_list_index.compare_meta`
- 프런트 `Program` monolith에서 화면별로 섞인 private 필드
- 추천 BFF의 `_reason`, `_fit_keywords`, `_score` 같은 transition 필드

### 문서 정리 대상

- `supabase/SQL.md`
- `supabase/README.md`
- `docs/current-state.md`
- `docs/specs/README.md`
- `docs/refactoring-log.md`

## 5. 단계별 검증 포인트

## 5.1 패키지 1 검증

- `profiles.target_job` 채움 비율
- `user_program_preferences` row 생성 수
- `user_recommendation_profile` row 생성 수와 `recommendation_ready` 비율
- `recommendations` unique/index drift 해소 여부

## 5.2 패키지 2 검증

- `program_source_records` row 수가 source 프로그램 수와 크게 어긋나지 않는지
- `programs.primary_source_record_id` 연결률
- `program_list_index` 새 summary 컬럼 누락률

## 5.3 패키지 3 검증

- admin/collector sync 후 legacy/new 값이 같은지
- `refresh_program_list_index()`가 statement timeout 없이 유지되는지
- profile/resume/activity write 후 `user_recommendation_profile.last_derived_at` 갱신되는지

## 5.4 패키지 4 검증

- `/programs/list`, `/programs/popular`, 추천 카드, 북마크 카드, 캘린더 카드가 같은 `program_id`에 같은 요약값을 보여주는지
- 추천이 프로그램 요약을 덮어쓰지 않고 `context`만 붙이는지
- 비교 관련도 계산이 `bio` 대신 `target_job` 우선순위를 따르는지

## 5.5 패키지 5 검증

- legacy fallback이 제거돼도 화면 regression이 없는지
- `SQL.md`와 실제 migration chain, backend 코드가 다시 어긋나지 않는지

## 6. 롤백 원칙

### 패키지 1~2

- additive migration이므로 read switch 전에는 즉시 롤백 가능하다.
- 새 테이블/새 컬럼을 비워 두고 기존 경로를 계속 쓰면 된다.

### 패키지 3

- dual write 단계에서는 새 write가 실패해도 legacy write를 보존해야 한다.
- 이 구간은 “new path soft-fail” 원칙이 안전하다.

### 패키지 4

- read switch는 feature flag 또는 endpoint/BFF 단위로 잘라서 해야 한다.
- 목록/card/detail/recommend를 한 번에 묶어 바꾸면 rollback 범위가 너무 커진다.

### 패키지 5

- cleanup은 마지막이다.
- cleanup 전에는 반드시 validation SQL, row count 비교, 대표 화면 smoke를 남겨야 한다.

## 7. 권장 migration 파일 네이밍 체인

아래는 이번 문서 기준 권장 순서다.

1. `20260425103000` ~ `20260425112000` 사용자 추천 축  
2. `20260425113000_create_program_source_records.sql`  
3. `20260425114000_add_program_canonical_columns.sql`  
4. `20260425115000_backfill_program_source_records_from_programs.sql`  
5. `20260425116000_backfill_program_canonical_fields.sql`  
6. `20260425117000_extend_program_list_index_surface_contract.sql`  
7. `20260425118000_dual_write_program_ingest.sql` 또는 대응 코드 전환  
8. `20260425119000_cleanup_program_legacy_columns.sql`

주의:

- 7번은 SQL만으로 끝나지 않을 수 있다.
- 실제 dual write는 backend/admin code patch와 묶이는 것이 더 자연스럽다.

## 8. 이번 문서에서 고정하는 판단

- 통합 로드맵의 시작점은 이미 작성된 사용자 추천 draft migration이다.
- 그 다음은 프로그램 provenance 분리와 canonical 컬럼 additive다.
- read switch는 serializer/API/BFF 순으로 잘라서 진행해야 한다.
- cleanup은 가장 마지막이다.
