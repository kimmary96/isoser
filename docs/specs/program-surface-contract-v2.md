# Program Surface Contract v2

기준일: 2026-04-24  
상태: proposed  
범위: `programs` 도메인 스키마/API/UI 통합 개편 기준 계약

## 1. 문서 목적

이 문서는 같은 `program_id`가 아래 화면에서 항상 같은 의미와 같은 값으로 보이게 만들기 위한 기준 계약이다.

- 랜딩 카드
- 라이브보드
- 오퍼튜니티 피드
- Closing Soon 카드
- 프로그램 목록 테이블
- 대시보드 추천 프로그램
- 대시보드 북마크
- 비교 선택 모달
- 프로그램 상세
- 비교 본문

이 문서는 현재 구현된 운영 truth를 설명하는 문서가 아니다.  
현재 코드를 검토한 뒤, 대규모 개편에서 고정해야 할 최종 계약을 정의하는 스펙 문서다.

## 2. 현재 문제 정의

현재 저장소에서는 대부분의 프로그램 화면이 거대한 `Program` 타입 하나를 공유한다.  
문제는 같은 타입을 쓰더라도 각 화면이 값을 각자 다르게 해석한다는 점이다.

- 카드형 화면과 테이블형 화면이 같은 `Program`을 서로 다르게 가공한다.
- 랜딩 카드, 라이브보드, 오퍼튜니티 피드, 대시보드 추천 카드가 서로 다른 formatter를 가진다.
- 프로그램 목록 테이블은 카드보다 더 많은 열을 쓰지만 별도 계약이 없다.
- 비교 본문과 상세는 `ProgramDetail`을 쓰지만, 목록/카드와의 의미 체계가 완전히 분리되어 있지 않다.
- 프론트가 `compare_meta`, `cost_type`, `link`, `source_url`를 직접 뒤져서 표시 문구를 만들고 있다.

## 3. 실제 코드 검토 기준

아래 파일을 기준으로 계약을 재정리했다.

- `frontend/app/(landing)/programs/page.tsx`
- `frontend/app/(landing)/landing-a/_program-feed.tsx`
- `frontend/app/(landing)/landing-a/_hero.tsx`
- `frontend/app/(landing)/landing-c/_hero.tsx`
- `frontend/app/(landing)/landing-c/_program-feed.tsx`
- `frontend/app/dashboard/page.tsx`
- `frontend/app/(landing)/compare/program-select-modal.tsx`
- `frontend/app/(landing)/compare/page.tsx`
- `frontend/app/(landing)/compare/compare-table-sections.tsx`
- `frontend/app/(landing)/programs/[id]/page.tsx`
- `frontend/lib/types/index.ts`
- `backend/routers/programs.py`

핵심 관찰은 아래와 같다.

- 카드형 화면 대부분은 `ProgramDetail`이 아니라 `Program` 요약 데이터를 쓴다.
- 프로그램 목록 테이블도 `ProgramDetail`이 아니라 `Program`의 더 많은 필드를 쓴다.
- `ProgramDetail`은 상세 페이지와 비교 본문에서만 본격적으로 사용된다.
- 따라서 `카드와 목록을 하나로`, 또는 `목록을 ProgramDetail로` 가는 구조는 둘 다 맞지 않다.

## 4. 최종 계약 구조

이번 개편에서는 프로그램 화면 계약을 아래 5개로 고정한다.

1. `ProgramBaseSummary`
2. `ProgramCardSummary`
3. `ProgramListRow`
4. `ProgramDetailResponse`
5. `ProgramSurfaceContext`

핵심 원칙은 아래와 같다.

- 카드형과 테이블형은 같은 뿌리를 공유하되, 동일 계약으로 억지 통합하지 않는다.
- 상세는 별도 계약으로 유지한다.
- 추천 점수, 북마크 여부, 노출 사유는 프로그램 정본이 아니라 화면 문맥으로 분리한다.

## 5. 타입 계약

```ts
type DeadlineConfidence = "high" | "medium" | "low";
type RecruitingStatus = "open" | "closing_soon" | "closed" | "unknown";
type SurfaceType =
  | "landing"
  | "liveboard"
  | "opportunity_feed"
  | "closing_soon"
  | "program_list"
  | "dashboard_recommendation"
  | "dashboard_bookmark"
  | "compare_select"
  | "compare_detail";
```

```ts
export interface ProgramBaseSummary {
  id: string;

  title: string;
  provider_name: string | null;
  source_code: string;
  source_label: string;

  summary_text: string | null;
  display_categories: string[];
  region_label: string | null;

  application_start_date: string | null;
  application_end_date: string | null;
  program_start_date: string | null;
  program_end_date: string | null;

  is_open: boolean | null;
  recruiting_status: RecruitingStatus;
  recruiting_status_label: string;
  days_left: number | null;
  deadline_confidence: DeadlineConfidence;

  primary_link: string | null;
  detail_path: string;
  compare_path: string;
}
```

```ts
export interface ProgramCardSummary extends ProgramBaseSummary {
  thumbnail_url: string | null;

  location_label: string | null;
  program_period_label: string | null;

  cost_label: string;
  teaching_method_label: string | null;
  participation_label: string | null;

  keyword_labels: string[];
  badge_labels: string[];
}
```

```ts
export interface ProgramListRow extends ProgramBaseSummary {
  location_label: string | null;
  program_period_label: string | null;

  cost_label: string;
  teaching_method_label: string | null;
  participation_label: string | null;
  selection_process_label: string | null;

  keyword_labels: string[];
}
```

```ts
export interface ProgramSurfaceContext {
  surface_type: SurfaceType;

  is_bookmarked?: boolean | null;
  bookmarked_at?: string | null;

  recommendation_score?: number | null;
  recommendation_label?: string | null;
  recommendation_reasons?: string[];

  exposure_reason?: string | null;
  exposure_rank?: number | null;
}
```

```ts
export interface ProgramDetailBody {
  organizer_name: string | null;

  application_schedule_label: string | null;
  program_schedule_label: string | null;

  application_url: string | null;
  detail_url: string | null;
  source_url: string | null;

  description: string | null;
  location_label: string | null;

  fee_amount: number | null;
  support_amount: number | null;
  cost_label: string | null;
  support_type_label: string | null;

  business_type: string | null;
  target_detail: string | null;
  eligibility_labels: string[];
  selection_process_label: string | null;

  contact_phone: string | null;
  contact_email: string | null;
  capacity_total: number | null;
  capacity_current: number | null;

  rating_value: number | null;
  review_count: number | null;

  tags: string[];
  skills: string[];
  curriculum_items: string[];
  certifications: string[];

  source_specific: Record<string, unknown>;
}
```

```ts
export interface ProgramDetailResponse {
  summary: ProgramBaseSummary;
  detail: ProgramDetailBody;
  context?: ProgramSurfaceContext | null;
}

export interface ProgramCardItem {
  program: ProgramCardSummary;
  context: ProgramSurfaceContext | null;
}

export interface ProgramListRowItem {
  program: ProgramListRow;
  context: ProgramSurfaceContext | null;
}

export interface ProgramCompareItem {
  summary: ProgramBaseSummary;
  detail: ProgramDetailBody | null;
}
```

## 6. 의미 고정 규칙

- `application_*`는 모집/접수 기간이다.
- `program_*`는 교육/운영 기간이다.
- 모집 상태는 오직 `application_end_date` 기준으로 계산한다.
- `program_end_date`를 마감일처럼 사용하면 안 된다.
- `primary_link` 우선순위는 `application_url -> detail_url -> source_url`이다.
- `source_code`는 기계용 코드다.
- `source_label`은 사용자 표시용 이름이다.
- `cost_label`, `program_period_label`, `teaching_method_label`, `participation_label`, `selection_process_label`, `recruiting_status_label`은 backend가 완성해서 내려준다.
- 프론트는 `compare_meta`를 직접 읽어 카드/테이블 문구를 만들지 않는다.
- `ProgramSurfaceContext`는 프로그램 정본 의미를 덮어쓰면 안 된다.

## 7. 화면별 고정 매핑

| 화면 | 고정 계약 |
| --- | --- |
| 랜딩 카드 | `ProgramCardItem` |
| 라이브보드 | `ProgramCardItem` |
| 오퍼튜니티 피드 | `ProgramCardItem` |
| Closing Soon 카드 | `ProgramCardItem` |
| 대시보드 추천 | `ProgramCardItem` |
| 대시보드 북마크 | `ProgramCardItem` |
| 비교 선택 모달 | `ProgramCardItem` |
| 프로그램 목록 테이블 | `ProgramListRowItem` |
| 프로그램 상세 | `ProgramDetailResponse` |
| 비교 본문 | `ProgramCompareItem` |

## 8. 데이터 원천 고정

각 계약은 아래 원천을 사용한다.

- `ProgramBaseSummary`: `program_list_index`
- `ProgramCardSummary`: `program_list_index`
- `ProgramListRow`: `program_list_index`
- `ProgramDetailBody`: `programs`
- `source_specific`, raw payload, field evidence: `program_source_records`
- `ProgramSurfaceContext`: 추천/북마크/노출 정책 계층

이 결정에 따라 아래도 고정한다.

- 카드형 화면은 raw `programs`를 직접 읽지 않는다.
- 테이블형 목록도 가능하면 `program_list_index`만 읽는다.
- 상세/비교 본문만 `programs`를 읽는다.

## 9. 금지 규칙

- 프로그램 목록 테이블이 `ProgramDetail` endpoint를 기본 데이터 소스로 쓰면 안 된다.
- 카드 화면이 화면별 로컬 helper로 비용, 마감, 링크 문구를 다시 계산하면 안 된다.
- 추천 API가 프로그램 summary를 자기 방식으로 다시 만들어 내려주면 안 된다.
- 북마크 화면이 raw `programs`를 직접 읽어 카드 데이터를 만들면 안 된다.
- `compare_meta`를 프론트 표시 로직의 직접 입력으로 쓰면 안 된다.
- 현재 거대한 `Program` 타입을 최종 구조로 유지하면 안 된다.

## 10. 권장 serializer 구조

backend는 아래 serializer 계층으로 정리하는 것을 기준으로 한다.

- `serialize_program_base_summary()`
- `serialize_program_card_summary()`
- `serialize_program_list_row()`
- `serialize_program_detail()`
- `build_program_surface_context()`

핵심은 각 화면이 raw row를 직접 해석하지 않고, backend serializer가 표시 규칙을 단일화하는 것이다.

## 11. 스키마/읽기모델 설계에 주는 의미

이 계약에 맞춰 이후 스키마 설계는 아래 방향으로 진행한다.

- `programs`는 상세 정본이다.
- `program_source_records`는 source 원본, field evidence, source-specific 식별자 저장소다.
- `program_list_index`는 카드형과 테이블형 모두를 지원하는 summary projection이다.

즉, 이번 개편의 핵심은 `programs` 하나에 모든 표시 의미를 몰아넣는 것이 아니라, 정본과 projection을 분리하는 것이다.

## 12. 다음 작업 순서

이 문서를 고정한 뒤 바로 이어서 해야 할 순서는 아래와 같다.

1. `패키지 1 스키마 설계서`
   - `programs`
   - `program_source_records`
   - `program_list_index`
   - 위 3개를 이 계약에 맞춰 최종 컬럼 수준으로 확정

2. `패키지 2 serializer / API 계약서`
   - backend list/detail serializer 구조 확정
   - 카드형 응답과 테이블형 응답을 분리
   - 추천/북마크/context 합성 규칙 확정

3. `패키지 3 migration 로드맵`
   - schema add
   - backfill
   - write switch
   - read switch
   - validate
   - cleanup

4. `패키지 4 화면 전환 순서`
   - 랜딩 카드
   - 라이브보드
   - 오퍼튜니티 피드
   - 대시보드 추천/북마크
   - 프로그램 목록 테이블
   - 비교/상세

## 13. 비목표

이 문서 자체는 아래를 직접 결정하지 않는다.

- 최종 migration SQL
- source별 세부 필드 backfill 규칙
- 실제 endpoint URL 변경 여부
- UI 스타일 개편

이 항목들은 다음 단계 문서에서 다룬다.
