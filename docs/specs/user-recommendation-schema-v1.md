# User Recommendation Schema v1

기준일: 2026-04-24  
상태: proposed  
범위: 맞춤형 프로그램 추천을 위한 사용자 정보 스키마 재정의

## 1. 문서 목적

이 문서는 맞춤형 프로그램 추천 기능을 위해 사용자 정보를 어떤 구조로 저장해야 하는지 정리한 기준 문서다.

이번 문서는 아래를 함께 다룬다.

- `supabase/SQL.md` 기준 현재 사용자 관련 실DB 스키마
- 현재 추천 로직이 실제로 읽는 사용자 필드
- 현재 구조의 의미 충돌과 누락
- 최종 권장 사용자 추천 스키마
- 추가로 정리해야 할 drift와 후속 우선순위

## 2. 결론 요약

현재 구조는 `profiles` 하나에 추천 입력 의미를 과도하게 기대하고 있다.

문제는 아래 3가지다.

1. 추천에 중요한 `희망 직무`, `선호 지역`, `배우고 싶은 기술`이 정식 컬럼으로 정리돼 있지 않다.
2. 실제 추천은 `profiles + activities`를 읽지만, 그 의미가 UI와 스키마에서 일치하지 않는다.
3. 추천 캐시 `recommendations`는 코드가 기대하는 계약과 `SQL.md` 문서가 어긋난다.

따라서 최종 구조는 아래처럼 가는 것이 맞다.

- `profiles`: 기본 사용자/연락처/표시용 프로필
- `activities`: 경험 근거 데이터
- `user_program_preferences`: 사용자가 직접 입력한 추천 선호
- `user_recommendation_profile`: 추천 엔진이 읽는 정규화/파생 프로필
- `user_program_events`: 북마크/비교/캘린더 적용/상세 조회 같은 행동 신호 저장소

## 3. `SQL.md` 기준 현재 사용자 관련 실DB 구조

### 3.1 `profiles`

현재 `SQL.md` 기준 `profiles`는 아래 필드를 가진다.

- `id`
- `name`
- `email`
- `phone`
- `education`
- `career`
- `education_history`
- `awards`
- `certifications`
- `languages`
- `skills`
- `self_intro`
- `avatar_url`
- `bio`
- `portfolio_url`
- `address`
- `region`
- `region_detail`

즉, 현재 실DB 기준 `profiles`에는 아래 필드가 없다.

- `target_job`
- `desired_job`
- `preferred_regions`
- `preferred_categories`
- `preferred_teaching_methods`
- `desired_skills`

### 3.2 `activities`

현재 `activities`는 추천 근거로 활용 가능한 아래 정보를 가진다.

- `title`
- `role`
- `description`
- `skills`
- `period`
- `type`

다만 전부 자유 텍스트/배열이라 정규화 기준은 약하다.

### 3.3 `resumes`

`resumes`에는 `target_job`이 있다.

하지만 이 값은 현재 추천 정본으로 직접 연결돼 있지 않다.  
즉, 사용자가 이력서에 목표 직무를 적어도 추천 엔진 정본에 안정적으로 합쳐지지 않는다.

### 3.4 `recommendations`

`SQL.md` 기준 `recommendations`는 아래 정도만 보인다.

- `user_id`
- `program_id`
- `score`
- `reason`
- `similarity_score`
- `relevance_score`
- `urgency_score`
- `final_score`
- `generated_at`

하지만 현재 코드와 migration 체인은 이보다 더 많은 필드를 기대한다.

- `query_hash`
- `profile_hash`
- `expires_at`
- `fit_keywords`
- unique key: `user_id + query_hash + program_id`

즉, `recommendations`는 `SQL.md`와 코드 계약이 가장 크게 어긋나는 영역 중 하나다.

## 4. 현재 추천 로직이 실제로 읽는 사용자 정보

현재 추천/비교/캘린더 추천 로직이 읽는 필드는 아래와 같다.

### 4.1 추천 캐시 hash 입력

`backend/routers/programs.py`는 profile hash를 아래 값으로 만든다.

- `name`
- `bio`
- `education`
- `job_title`
- `self_intro`
- `portfolio_url`
- `career`
- `education_history`
- `awards`
- `certifications`
- `languages`
- `skills`
- 활동 20건의 `title`, `role`, `description`, `skills`, `period`, `type`

### 4.2 RAG 추천 입력

`backend/rag/programs_rag.py`는 아래를 추천 query와 keyword로 읽는다.

- `bio`
- `education`
- `job_title`
- `self_intro`
- `career`
- `education_history`
- `awards`
- `certifications`
- `languages`
- `skills`
- 활동의 `skills`, `title`, `role`, `description`

### 4.3 비교 관련도 입력

`POST /programs/compare-relevance`는 아래를 읽는다.

- `profile.target_job`
- `profile.desired_job`
- `profile.job_title`
- `profile.skills`
- `profile.region`
- `profile.region_detail`
- `profile.address`
- 활동 존재 여부
- `self_intro`, `bio`, `career`

여기서 가장 중요한 문제는 아래다.

- 점수 계산은 `target_job`을 중요한 축으로 보는데
- 현재 `profiles`에는 그 정식 컬럼이 없다

즉, 비교 관련도 로직은 이미 “있어야 하는 사용자 추천 필드”를 가정하고 있다.

## 5. 현재 구조의 주요 문제

### 5.1 `bio` 의미 오염

대시보드 프로필 편집 UI는 `bio` 입력칸 라벨을 `희망 직무 (선택)`으로 보여준다.  
즉, 현재 UI는 `bio`를 소개 문장이 아니라 희망 직무처럼 쓰고 있다.

이건 의미 충돌이다.

- `bio`는 원래 한 줄 소개/태그라인 성격
- `target_job`은 추천 엔진 핵심 입력

둘은 분리되어야 한다.

### 5.2 `희망 직무` 정본 부재

현재 추천/비교 로직은 `target_job` 또는 `job_title`을 읽고 싶어 한다.  
하지만 실DB `profiles` 정본에는 해당 필드가 없다.

결과적으로 현재는 아래 문제가 생긴다.

- 추천 요청 payload에만 임시 `job_title`을 넣는다
- resume의 `target_job`는 따로 저장된다
- profile UI에서는 `bio`에 저장한다

즉, 희망 직무의 단일 정본이 없다.

### 5.3 거주지와 추천 선호 지역 미분리

현재 `address`, `region`, `region_detail`은 사실상 거주지/주소 정규화 값이다.  
하지만 추천과 비교는 이를 선호 지역처럼 사용한다.

이렇게 되면 아래가 구분되지 않는다.

- 내가 사는 곳
- 내가 지원하고 싶은 지역
- 온라인도 가능한지

### 5.4 현재 스킬과 희망 스킬 미분리

현재 `skills`는 보유 스킬인지, 관심 스킬인지, 이력서용 키워드인지 구분되지 않는다.

추천에서는 아래가 분리돼야 한다.

- 현재 보유 스킬
- 활동 근거가 있는 스킬
- 배우고 싶은 스킬

### 5.5 추천 캐시 hash 입력 과다

현재 `profile_hash`는 `name`, `portfolio_url` 같은 추천과 직접 관련 없는 값도 포함한다.

이렇게 되면 아래 문제가 생긴다.

- 추천 내용이 안 바뀌어도 캐시가 자주 무효화된다
- 추천 cache invalidation 기준이 불안정하다

### 5.6 행동 신호 저장소 부재

현재 아래 데이터는 존재하지만 추천 입력으로 정식 구조화돼 있지 않다.

- `program_bookmarks`
- `calendar_program_selections`
- 프로그램 상세 진입

즉, 행동 기반 추천으로 확장할 기반 스키마가 없다.

## 6. 최종 권장 사용자 추천 스키마

## 6.1 `profiles`는 유지하되 역할 축소

`profiles`는 아래 역할만 담당하는 것이 맞다.

- 사용자 기본 식별
- 연락처/프로필 표시 정보
- 소개/학력/포트폴리오
- 거주지 원문과 표시용 정규화 지역

권장 필드:

- `id`
- `name`
- `email`
- `phone`
- `avatar_url`
- `bio`
- `self_intro`
- `education`
- `portfolio_url`
- `address`
- `region`
- `region_detail`
- `created_at`
- `updated_at`

즉, `profiles`는 더 이상 추천 선호의 유일한 정본이 아니다.

## 6.2 `user_program_preferences` 신설

이 테이블은 사용자가 직접 고른 추천 선호를 저장한다.

권장 컬럼:

- `user_id uuid primary key references auth.users(id)`
- `target_job text null`
- `target_job_normalized text null`
- `preferred_regions text[] not null default '{}'`
- `preferred_region_details text[] not null default '{}'`
- `preferred_categories text[] not null default '{}'`
- `preferred_teaching_methods text[] not null default '{}'`
- `preferred_participation_times text[] not null default '{}'`
- `preferred_cost_types text[] not null default '{}'`
- `desired_skills text[] not null default '{}'`
- `remote_ok boolean null`
- `max_cost integer null`
- `updated_at timestamptz not null default now()`

이 테이블의 목적은 아래를 분리하는 것이다.

- 거주지 vs 선호 지역
- 보유 스킬 vs 배우고 싶은 스킬
- 소개 문장 vs 희망 직무

## 6.3 `user_recommendation_profile` 신설

이 테이블은 추천 엔진이 실제로 읽는 정규화/파생 정본이다.

권장 컬럼:

- `user_id uuid primary key references auth.users(id)`
- `effective_target_job text null`
- `effective_target_job_normalized text null`
- `profile_keywords text[] not null default '{}'`
- `evidence_skills text[] not null default '{}'`
- `desired_skills text[] not null default '{}'`
- `activity_keywords text[] not null default '{}'`
- `preferred_regions text[] not null default '{}'`
- `profile_completeness_score numeric not null default 0`
- `recommendation_ready boolean not null default false`
- `recommendation_profile_hash text not null`
- `derivation_version integer not null default 1`
- `source_snapshot jsonb not null default '{}'::jsonb`
- `last_derived_at timestamptz not null default now()`

핵심은 아래다.

- `profiles`와 `activities`를 직접 추천 캐시 hash 입력으로 쓰지 않는다.
- 추천은 `user_recommendation_profile`을 정본으로 쓴다.

## 6.4 `user_program_events`는 2차 도입

이 테이블은 행동 신호를 저장한다.

권장 컬럼:

- `id bigserial primary key`
- `user_id uuid not null`
- `program_id uuid not null`
- `event_type text not null`
- `event_meta jsonb not null default '{}'::jsonb`
- `created_at timestamptz not null default now()`

권장 event_type:

- `bookmark_added`
- `bookmark_removed`
- `detail_viewed`
- `compare_added`
- `calendar_applied`
- `calendar_removed`

이 테이블은 1차보다 2차 우선순위다.  
먼저 선호/정규화 프로필 구조를 고정한 뒤 행동 신호를 붙이는 것이 낫다.

## 7. 추천 시스템 관점의 최종 역할 분리

| 계층 | 역할 |
| --- | --- |
| `profiles` | 사용자 기본 프로필/표시 정보 |
| `activities` | 경험 근거 데이터 |
| `resumes` | 문서 자산 |
| `user_program_preferences` | 사용자가 직접 입력한 추천 선호 |
| `user_recommendation_profile` | 추천 엔진 정본 |
| `recommendations` | 추천 결과 캐시 |
| `user_program_events` | 행동 기반 신호 |

## 8. `SQL.md` 기준 추가로 정리해야 할 것

### 8.1 `recommendations` 문서 드리프트

`SQL.md`의 `recommendations` 스냅샷은 현재 코드가 기대하는 추천 캐시 계약을 충분히 반영하지 않는다.

최소한 아래는 같이 정리돼야 한다.

- `query_hash`
- `profile_hash`
- `expires_at`
- `fit_keywords`
- unique 기준

즉, 사용자 추천 스키마를 정리할 때 `recommendations` drift도 같이 해결해야 한다.

### 8.2 `resumes.target_job`와 추천 정본 연결

현재 `resumes.target_job`는 저장되지만 추천 정본으로 직접 흡수되지 않는다.

권장 방향:

- `user_program_preferences.target_job`가 비어 있으면
- 최신 resume의 `target_job`를 fallback 입력으로 사용할 수 있게 한다

### 8.3 `activities.skills` 정규화 부족

활동의 `skills`는 추천 근거로 매우 중요하지만 현재는 자유 입력 배열이다.

장기적으로는 아래가 필요하다.

- normalize rule
- alias 정리
- canonical skill dictionary

### 8.4 profile edit UI 의미 수정

현재 UI의 `희망 직무` 입력은 `bio`로 저장된다.  
이건 스키마 정리와 함께 반드시 바로잡아야 한다.

### 8.5 cache invalidation 기준 축소

현재 추천 캐시 무효화는 너무 넓은 프로필 스냅샷을 기준으로 한다.

권장 방향:

- `user_recommendation_profile.recommendation_profile_hash` 기준으로 단순화

## 9. 우선순위

### P0

- `bio`와 `target_job` 의미 분리
- `user_program_preferences` 도입
- `user_recommendation_profile` 도입

### P1

- `recommendations` 캐시 계약과 `SQL.md`/migration 정합성 복구
- `resumes.target_job` fallback 연결
- 거주지와 선호 지역 분리

### P2

- `user_program_events` 도입
- 활동/프로필 스킬 정규화
- 행동 기반 추천 가중치 추가

## 10. 구현 전 반드시 고정할 원칙

- 추천 정본은 `profiles` 단독이 아니다.
- `bio`는 태그라인이고 `target_job`이 아니다.
- 추천 cache hash는 원본 row 전체가 아니라 추천 정본에서 만든다.
- 거주지와 선호 지역은 분리한다.
- 보유 스킬과 배우고 싶은 스킬은 분리한다.

## 11. 다음 문서

이 문서 다음에는 아래 순서로 이어가는 것이 맞다.

1. `사용자 추천 스키마 migration 설계서`
2. `추천 serializer / profile derivation 설계서`
3. `program 추천 스키마와 program surface 계약 연결 문서`
