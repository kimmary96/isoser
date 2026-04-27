# User Recommendation Serializer Contract v1

기준일: 2026-04-24  
상태: proposed  
범위: 사용자 추천 파생 프로필, 관련도 가중치, 추천 응답 serializer 계약

## 1. 문서 목적

이 문서는 아래 3가지를 한 번에 고정하기 위한 스펙이다.

1. 추천 엔진이 어떤 사용자 정본을 읽을지
2. 관련도 가중치와 breakdown을 어떤 구조로 계산할지
3. 추천 결과를 프로그램 화면 계약과 어떻게 연결할지

이 문서는 아래 문서를 이어받는다.

- [program-surface-contract-v2.md](./program-surface-contract-v2.md)
- [user-recommendation-schema-v1.md](./user-recommendation-schema-v1.md)
- [user-recommendation-schema-migration-plan-v1.md](./user-recommendation-schema-migration-plan-v1.md)
- `cowork/drafts/relevance-scoring-v2.md`

## 2. 최상위 원칙

### 2.1 `program-surface-contract-v2`를 깨지 않는다

추천은 프로그램 정본을 바꾸지 않는다.  
추천은 `ProgramCardSummary`나 `ProgramListRow` 값을 덮어쓰는 것이 아니라, `ProgramSurfaceContext`에 추천 문맥만 얹는다.

즉 추천 연결 규칙은 아래처럼 고정한다.

- 프로그램 정보 정본: `ProgramCardSummary`, `ProgramListRow`, `ProgramDetailResponse`
- 추천 문맥 정본: `ProgramSurfaceContext`
- 추천 이유/점수/뱃지: `ProgramSurfaceContext` 또는 추천 전용 payload

### 2.2 `bio`는 더 이상 희망 직무 정본이 아니다

희망 직무 우선순위는 아래처럼 고정한다.

1. `user_program_preferences.target_job`
2. `profiles.target_job`
3. 최근 `resumes.target_job`
4. legacy fallback으로서의 `profiles.bio`

### 2.3 추천 엔진은 raw profile이 아니라 파생 정본을 읽는다

최종 정본은 `user_recommendation_profile`이다.

- `profiles`: 사용자 기본 프로필
- `user_program_preferences`: 사용자 명시 선호
- `user_recommendation_profile`: 추천 엔진 입력 정본

## 3. 현재 코드와 초안 문서의 조정 사항

`cowork/drafts/relevance-scoring-v2.md`는 방향이 맞지만, 현재 저장소 기준으로는 아래를 수정해서 적용해야 한다.

| 항목 | 초안 | 현재 저장소 기준 최종 적용 |
| --- | --- | --- |
| 희망 직무 소스 | `resumes.target_job`, `cover_letters.job_title`, `profiles.bio/self_intro` 중심 | `user_program_preferences.target_job`, `profiles.target_job`, 최근 `resumes.target_job`, legacy `profiles.bio` fallback |
| 지역 신호 | 주소 필드 추가 후 반영 | `profiles.region`, `profiles.region_detail`, `address`, `user_program_preferences.preferred_regions`를 함께 사용 |
| 행동 신호 | `bookmarks`, `calendar_program_selections` | 실제 정본은 `program_bookmarks`, `calendar_program_selections` |
| 프로그램 응답 연결 | `/recommend` 응답 확장 | `program-surface-contract-v2`에 맞춰 추천 정보는 surface context로 연결 |

## 4. 추천 파생 프로필 계약

### 4.1 Raw 입력 계약

```ts
export interface RecommendationProfileSource {
  user_id: string;
  profile: {
    target_job?: string | null;
    bio?: string | null;
    self_intro?: string | null;
    education?: string | null;
    region?: string | null;
    region_detail?: string | null;
    address?: string | null;
    portfolio_url?: string | null;
    skills?: string[];
    career?: string[];
    education_history?: string[];
    awards?: string[];
    certifications?: string[];
    languages?: string[];
  };
  preferences: {
    target_job?: string | null;
    preferred_regions?: string[];
    preferred_region_details?: string[];
    preferred_categories?: string[];
    preferred_teaching_methods?: string[];
    preferred_participation_times?: string[];
    preferred_cost_types?: string[];
    desired_skills?: string[];
    remote_ok?: boolean | null;
    max_cost?: number | null;
  } | null;
  recent_resume_target_job?: string | null;
  activities: Array<{
    id: string;
    type: string;
    title?: string | null;
    role?: string | null;
    description?: string | null;
    skills?: string[];
    is_visible?: boolean | null;
  }>;
  behavior: {
    recent_bookmark_program_ids: string[];
    recent_calendar_program_ids: string[];
  };
}
```

### 4.2 Derived 입력 정본 계약

```ts
export interface UserRecommendationProfile {
  user_id: string;
  effective_target_job: string | null;
  effective_target_job_normalized: string | null;

  profile_keywords: string[];
  evidence_skills: string[];
  desired_skills: string[];
  activity_keywords: string[];
  preferred_regions: string[];

  profile_completeness_score: number;
  recommendation_ready: boolean;
  recommendation_profile_hash: string;
  derivation_version: number;

  source_snapshot: {
    profile_target_job?: string | null;
    preference_target_job?: string | null;
    resume_target_job?: string | null;
    legacy_bio_fallback_used?: boolean;
    region_fallback_used?: boolean;
  };
}
```

## 5. 파생 규칙

### 5.1 희망 직무

우선순위:

1. `user_program_preferences.target_job`
2. `profiles.target_job`
3. 최근 `resumes.target_job`
4. `profiles.bio`

정규화:

- trim
- lower
- 연속 공백 축소
- 직무 alias 사전은 이후 Python 계층에서 추가

### 5.2 보유 스킬

`evidence_skills`는 아래를 합친다.

- `profiles.skills`
- `activities.skills` 중 `is_visible=true`

### 5.3 희망 스킬

`desired_skills`는 `user_program_preferences.desired_skills` 정본을 사용한다.

### 5.4 지역 선호

우선순위:

1. `user_program_preferences.preferred_regions`
2. `profiles.region`
3. `profiles.region_detail`
4. 필요 시 `profiles.address` 파생

### 5.5 활동 키워드

`activity_keywords`는 아래를 합친다.

- `activities.title`
- `activities.role`
- `activities.description`
- `activities.skills`

### 5.6 준비도 점수

`profile_completeness_score`는 0~1 범위로 계산한다.

기본 배점:

- 희망 직무 존재: `0.30`
- 보유 스킬 존재: `0.25`
- 활동 이력 존재: `0.20`
- 지역 선호 존재: `0.15`
- 자기소개/경력 텍스트 존재: `0.10`

### 5.7 추천 가능 여부

`recommendation_ready=true` 조건:

- 희망 직무가 있거나
- 보유 스킬이 있거나
- 활동 이력이 있으면 true

## 6. 관련도 가중치 계약

가중치 기준은 `cowork/drafts/relevance-scoring-v2.md`를 따르되, 현재 저장소 현실에 맞게 아래처럼 고정한다.

### 6.1 기본 가중치

| 요소 | 가중치 | 최종 소스 |
| --- | ---: | --- |
| 희망 직무 | 30 | `effective_target_job` |
| 보유 스킬 | 25 | `evidence_skills` |
| 경험 도메인 | 15 | `activity_keywords` |
| 지역 | 15 | `preferred_regions` |
| 준비도 | 10 | `profile_completeness_score` |
| 행동 신호 | 5 | `program_bookmarks`, `calendar_program_selections` |

### 6.2 지역 신호가 없을 때 임시 가중치

| 요소 | 가중치 |
| --- | ---: |
| 희망 직무 | 35 |
| 보유 스킬 | 30 |
| 경험 도메인 | 20 |
| 지역 | 0 |
| 준비도 | 10 |
| 행동 신호 | 5 |

## 7. 추천 serializer 계약

### 7.1 내부 추천 결과 계약

```ts
export interface RecommendationBreakdown {
  target_job: number;
  skills: number;
  experience: number;
  region: number;
  readiness: number;
  behavior: number;
}

export type RecommendationGrade = "strong" | "match" | "partial" | "low";

export interface ProgramRecommendationContext {
  recommendation_score: number | null;
  recommendation_label: string | null;
  recommendation_reasons: string[];
  fit_keywords: string[];
  relevance_score: number | null;
  relevance_grade: RecommendationGrade;
  relevance_badge: string | null;
  score_breakdown: RecommendationBreakdown | null;
}
```

### 7.2 `program-surface-contract-v2` 연결 규칙

대시보드 추천 카드의 최종 목표 구조는 아래다.

```ts
export interface RecommendedProgramCardItem {
  program: ProgramCardSummary;
  context: ProgramSurfaceContext & ProgramRecommendationContext;
}
```

중요:

- `program.title`, `program.provider_name`, `program.primary_link` 같은 프로그램 요약 정보는 추천이 바꾸지 않는다.
- 추천은 `context.recommendation_*`만 채운다.
- 현재 대시보드 BFF가 `Program` 객체에 `_reason`, `_fit_keywords`, `score`를 직접 섞는 방식은 transition 전용이다.

## 8. API 계약 전환 순서

### 8.1 1차

- `/programs/recommend`
- `/programs/recommend/calendar`
- `/programs/compare-relevance`

위 3개 경로가 `profiles + activities` 대신 `user_recommendation_profile`을 읽게 바꾼다.

### 8.2 2차

대시보드 추천 BFF는 현재처럼 `Program`을 변형하지 않고, `ProgramCardItem` 형태로 조립한다.

### 8.3 3차

랜딩/라이브보드/오퍼튜니티 피드와 동일한 카드 요약 계약 위에 추천 문맥만 얹는다.

## 9. 구현 우선순위

1. `profiles.target_job`, `user_program_preferences`, `user_recommendation_profile`, `recommendations` migration 적용
2. `refresh_user_recommendation_profile()`를 profile save/update 시점에 연결
3. 추천 hash 입력을 raw profile 전체가 아니라 `user_recommendation_profile.recommendation_profile_hash`로 전환
4. `/programs/recommend`, `/programs/recommend/calendar`, `/programs/compare-relevance`를 공통 derivation/serializer 계층으로 통합
5. 마지막에 `program-surface-contract-v2`의 `ProgramSurfaceContext`와 연결

## 10. 이번 문서에서 고정하는 판단

- 추천 정본은 `user_recommendation_profile`
- 사용자 직접 선호 정본은 `user_program_preferences`
- `bio`는 희망 직무 fallback일 뿐 정본이 아님
- 관련도 가중치는 `relevance-scoring-v2`를 기본으로 따르되, 실제 테이블/코드 기준으로 `program_bookmarks`, `preferred_regions`, `profiles.target_job`를 반영해 수정 적용
- 최종 UI 연결은 추천 payload가 아니라 `program-surface-contract-v2`를 따른다
