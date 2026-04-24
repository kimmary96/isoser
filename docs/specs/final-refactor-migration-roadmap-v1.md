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
- 프로그램 canonical/provenance draft migration도 `20260425113000` ~ `20260425117000`까지 저장소에 실제로 존재한다.
- `program_list_index`는 이미 운영 read-model로 사용 중이고, free-plan 검증용 sample refresh / provenance sample backfill helper도 추가돼 있다.
- backend `programs.py` 내부 serializer helper, frontend surface 타입, dashboard recommendation/calendar/bookmark/selection BFF의 `ProgramCardItem` seed도 이미 일부 반영돼 있다.
- `profile/resume/activity -> refresh_user_recommendation_profile()` 공통 연결은 이미 들어갔다.
- `POST /admin/sync/programs`와 collector scheduler 모두 `program_source_records` best-effort dual write와 additive canonical `programs` column seed를 같은 규칙으로 쓰기 시작했다.
- 따라서 저장소 코드 기준 패키지 3의 dual write seed 공백은 닫혔고, 다음 현재 패키지는 read switch 중심의 패키지 4다.
- `bookmarks` / `calendar-selections` BFF는 이제 `program_list_index` summary read를 우선 사용하고, read model 미적용/누락 row만 `programs` fallback으로 읽는다.
- `get_program_detail()` / `get_program_details_batch()`는 이제 `programs + program_source_records`를 함께 읽어 상세 응답을 조립하고, compare 상단 카드용 `POST /programs/batch`도 `program_list_index` summary read 우선 구조로 넘어갔다.
- `docs/specs/program-surface-contract-v2.md`, `docs/specs/user-recommendation-serializer-contract-v1.md`, `docs/specs/final-refactor-axis-map-v1.md`는 이미 상위 계약으로 고정돼 있다.

## 3. 전체 패키지 순서

| 패키지 | 목적 | 상태 |
| --- | --- | --- |
| 패키지 0 | 계약 고정 | 완료 |
| 패키지 1 | 사용자 추천 정본 additive migration | SQL draft 완료, write 연결은 진행 중 |
| 패키지 2 | 프로그램 정본/provenance additive migration | draft SQL 체인 + sample validation helper 완료 |
| 패키지 3 | backfill + dual write + serializer/API/BFF transition seed | 저장소 seed 기준 완료 |
| 패키지 4 | read switch | 진행 중 |
| 패키지 5 | cleanup / validation / 문서 정합성 | 부분 문서화만 반영, 미완료 |

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

### 현재 저장소 기준 메모

- `refresh_program_list_index_sample(...)`, `backfill_program_source_records_sample(...)`, 관련 CLI bundle은 이미 있어 bounded validation seed는 시작된 상태다.
- backend serializer helper와 dashboard BFF `ProgramCardItem` seed도 이미 일부 반영돼 있어, 패키지 3과 패키지 4의 경계가 문서보다 앞서 있다.
- `profile/resume/activity` refresh bridge, admin dual write, collector dual write가 모두 seed 되어 저장소 코드 기준 패키지 3은 완료로 본다.
- 남은 과제는 “새 구조를 읽는 쪽으로 전환”이므로, 현재 구현 중심 패키지는 패키지 4다.

### 해야 할 일

1. 기존 `programs.raw_data`와 `compare_meta.field_sources`를 `program_source_records`로 backfill  
2. 기존 `programs` 컬럼에서 canonical 값만 골라 새 정본 컬럼으로 backfill  
3. `refresh_program_list_index()`가 legacy 컬럼과 새 canonical 컬럼을 함께 읽을 수 있게 보정  
4. admin/collector sync가 한동안은 legacy + new 구조를 같이 쓰는 dual write로 전환  
5. profile/resume/activity write 이후 `refresh_user_recommendation_profile()`를 공통 연결

현재 저장소 기준 추가 메모:

- 1~3은 additive SQL / helper 초안이 모두 저장소에 있다.
- 4는 admin/collector 양쪽 모두 best-effort dual write seed가 들어갔다.
- 5는 완료됐다.
- 운영 DB 실제 migration apply, backfill 실행, row count validation은 여전히 별도 운영 절차다.

### 핵심 판단

- 프로그램 축과 사용자 추천 축 모두 “한 번에 read switch”가 아니라 “먼저 새 구조를 채우고, 그 다음 read를 옮긴다”가 맞다.

## 4.4 패키지 4: read switch

### 현재 저장소 기준 메모

- 대시보드 recommendation/calendar/bookmark/selection BFF는 이미 `items: ProgramCardItem[]` 응답으로 일부 전환됐다.
- backend recommendation/compare read는 이제 `user_recommendation_profile`을 우선 읽고, derived row가 없을 때만 legacy `profiles`로 fallback한다. raw `activities`는 아직 compare breakdown과 RAG 보조 입력 용도로 함께 읽는다.
- bookmarks/calendar BFF 내부 read도 이미 `program_list_index` summary read 우선 구조로 넘어갔다.
- compare 상단 카드 batch도 `program_list_index` summary read 우선, legacy `programs` fallback 구조로 전환됐다.
- 단건/배치 상세는 `programs + program_source_records` 조합을 읽기 시작했고, additive canonical detail 필드를 우선 사용한다.
- 따라서 패키지 4의 남은 핵심은 추천 BFF cleanup과 detail/compare read를 `program_list_index` / `program_source_records` 축에 더 맞추는 일이다.

### backend

1. 추천/비교 read를 raw profile에서 `user_recommendation_profile`로 전환  
   현재 상태: 완료, 단 raw `activities` 보조 read는 아직 유지
2. 목록/card read를 `program_list_index` 명시 컬럼 serializer로 전환  
   현재 상태: 대부분 seed 완료, remaining cleanup 위주
3. 상세 read를 `programs + program_source_records` 조합으로 전환
   현재 상태: 단건/배치 상세는 진행 중, compare/detail cleanup 남음

### BFF

1. 대시보드 추천 BFF  
   현재 상태: 응답 seed 완료, transition cleanup 남음
2. 북마크/캘린더 BFF  
   현재 상태: 완료, recommend-calendar direct Supabase fallback도 `program_list_index` 우선 구조로 정리됨
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
