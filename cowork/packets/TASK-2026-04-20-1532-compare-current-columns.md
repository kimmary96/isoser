---
id: TASK-2026-04-20-1532-compare-current-columns
status: queued
type: fix
title: Compare 페이지 - 현재 적재 컬럼 기준 비교 항목 재정의
priority: high
planned_by: codex
planned_at: 2026-04-20T15:32:00+09:00
planned_against_commit: b994efe8e9ba084b7a73e601bec0a3e7a8b7872f
---

# Goal

`/compare` 페이지가 현재 운영 적재 데이터로 실제 채워질 수 있는 컬럼만 사용하도록 비교 표를 재정의한다.

현재 compare UI는 `compare_meta` 중심 스펙을 따르지만, 운영 수집 경로는 해당 값을 채우지 않는다. 그 결과 대부분의 셀이 `"정보 없음"`으로 보이며, 사용자는 렌더링 오류처럼 인식한다.

이 Task의 목적은 compare 페이지를 현재 운영 DB와 수집 파이프라인 현실에 맞게 조정해:

- 현재 채워질 수 있는 컬럼만 기본 비교 항목으로 사용하고
- 채워지지 않는 메타 필드 의존 섹션은 제거 또는 축소하고
- 실제 빈 값과 현재 미수집 데이터를 구분하는 문구를 도입하는 것이다

# Current Reality

구현 전 아래 사실을 현재 HEAD 기준으로 다시 확인한다.

- 실제 compare 라우트는 `/programs/compare`가 아니라 `/compare`다
- 현재 구현 파일은 `frontend/app/(landing)/compare/page.tsx`와 `frontend/app/(landing)/compare/programs-compare-client.tsx`다
- 백엔드 프로그램 조회는 `backend/routers/programs.py`에서 `select="*"`로 Supabase `programs` row를 그대로 반환한다
- `compare_meta` 컬럼 migration은 존재하며 운영 DB에도 반영되었을 수 있지만, 현재 운영 수집 경로는 이 값을 채우지 않는다
- `backend/rag/collector/scheduler.py` -> `backend/rag/collector/normalizer.py` 경로는 주로 `title`, `source`, `deadline`, `category`, `location`, `link`, `target` 중심으로 저장한다
- `start_date`, `end_date`, `support_type`, `teaching_method`, `is_certified`는 일부 동기화 경로에서는 채워질 수 있지만 source별 편차가 있다
- `compare_meta` 기반 모집 대상 / 지원 허들 / 목표 직무 비교는 현재 운영 데이터만으로는 안정적으로 제공할 수 없다

# Scope

1. compare 표의 섹션과 행을 현재 적재 가능 컬럼 기준으로 재구성한다
2. `compare_meta`를 기본 렌더링 의존성에서 제거한다
3. `"정보 없음"`과 `"데이터 미수집"` 문구 사용 기준을 정의하고 UI에 반영한다
4. compare 카드 상단 chip/tag도 현재 컬럼 기준으로 단순화한다
5. 기존 URL 기반 슬롯 추가/제거, 추천 카드, 관련도 계산 흐름은 유지한다

# Revised Comparison Model

## 섹션 1. 기본 정보

아래 행만 유지한다.

| 항목 | 데이터 출처 | 비고 |
|---|---|---|
| 마감일 | `deadline` + `days_left` | 기존 강조 규칙 유지 |
| 과정 기간 | `start_date` ~ `end_date` | 둘 중 하나라도 없으면 fallback |
| 운영 기관 | `provider` | null/blank fallback |
| 지역 | `location` | null/blank fallback |
| 카테고리 | `category` | null/blank fallback |

## 섹션 2. 운영 정보

현재 스키마에 실제 존재하는 운영 메타 중심으로 비교한다.

| 항목 | 데이터 출처 | 비고 |
|---|---|---|
| 지원 유형 | `support_type` | 예: 무료, 일부 지원 |
| 수업 방식 | `teaching_method` | 예: 온라인, 오프라인, 혼합 |
| 인증 여부 | `is_certified` | `true -> 인증`, `false -> 미인증`, `null -> fallback` |
| 모집 상태 | `is_active` | `true -> 모집 중`, `false -> 마감 또는 비활성`, `null -> fallback` |
| 지원 링크 | `application_url` 우선, 없으면 `source_url`, 없으면 `link` | 텍스트 또는 버튼 상태로 표시 |

## 섹션 3. 프로그램 개요

비교 가치가 있고 현재 데이터 존재 가능성이 높은 필드만 사용한다.

| 항목 | 데이터 출처 | 비고 |
|---|---|---|
| 한줄 요약 | `summary` | 없으면 `description` fallback 가능 |
| 상세 설명 | `description` | 너무 길면 2~3줄 clamp |
| 주요 기술 스택 | `skills` | 기존 badge 형태 유지 |
| 태그 | `tags` | 배열/문자열 모두 허용 |
| 출처 | `source` | 카드 헤더와 중복돼도 테이블에서는 유지 가능 |

## 제거 대상

아래 compare 항목은 이번 Task에서 표 본문 기본 비교 항목에서 제거한다.

- `compare_meta.subsidy_rate`
- `compare_meta.employment_connection`
- `compare_meta.target_group`
- `compare_meta.age_restriction`
- `compare_meta.education_requirement`
- `compare_meta.employment_restriction`
- `compare_meta.experience_requirement`
- `compare_meta.coding_skill_required`
- `compare_meta.naeilbaeumcard_required`
- `compare_meta.employment_insurance`
- `compare_meta.portfolio_required`
- `compare_meta.interview_required`
- `compare_meta.target_job`

이 값들은 현재 운영 수집 기준으로 안정적으로 채워지지 않으므로 기본 compare 표에서 기대치를 만들지 않는다.

# Fallback Copy Rules

문구 기준을 아래처럼 고정한다.

- 값이 실제로 비어 있고, 현재 compare 항목이 운영 스키마의 실사용 컬럼인 경우: `"정보 없음"`
- 값이 비어 있는 것이 아니라 현재 운영 수집/정규화 범위 밖인 비교 항목인 경우: 해당 항목 자체를 표에서 제거한다
- 과정 기간, 지원 유형, 수업 방식, 인증 여부처럼 source별 미수집 가능성이 높은 항목은 값이 없을 때 `"데이터 미수집"`을 우선 사용한다
- 빈 슬롯은 기존처럼 `"정보 없음"`을 유지한다

즉 이번 Task 이후 `"데이터 미수집"`은 주로 source 메타/운영 정보 필드에 사용하고, 과거 `compare_meta` 기반 셀의 대량 `"정보 없음"` 노출은 구조적으로 제거한다.

# Card Header Adjustments

슬롯 카드 상단 chip은 현재 데이터 기준으로 단순화한다.

- 유지: D-day / 마감 상태
- 유지: `source`
- 조건부 유지: `teaching_method`
- 조건부 유지: `support_type`
- 제거: `compare_meta.target_group`
- 제거: `compare_meta.subsidy_rate`

# Acceptance Criteria

1. `/compare`에서 프로그램을 선택해도 compare 표 다수 셀이 `compare_meta` 부재 때문에 일괄 `"정보 없음"`으로 보이지 않는다
2. compare 표 본문이 현재 운영 DB에서 실제 채워질 수 있는 컬럼만 사용한다
3. 기존 `compare_meta` 기반 모집 대상 / 지원 허들 섹션은 제거되거나 현재 컬럼 기준 섹션으로 대체된다
4. 과정 기간, 지원 유형, 수업 방식, 인증 여부는 값이 없을 때 `"데이터 미수집"` 문구를 사용할 수 있다
5. `summary`, `description`, `skills`, `tags`, `provider`, `location`, `category` 등 현재 컬럼 비교는 정상 렌더링된다
6. compare 상단 card chip이 `compare_meta` 없이도 깨지지 않는다
7. URL `ids` 상태 관리, 슬롯 추가/제거, 추천 프로그램 영역, 관련도 계산 로직은 유지된다
8. 타입 오류 없이 빌드 가능해야 한다

# Constraints

- 라우트 기준은 반드시 현재 구현인 `/compare`로 맞춘다
- 기존 compare의 슬롯 수, URL state, 추천 카드, 관련도 API 흐름은 건드리지 않는다
- 브라우저에서 Supabase 직접 호출하지 않는다
- 대규모 디자인 리뉴얼이 아니라 비교 항목 재정의와 문구 보정에 집중한다
- `compare_meta` 타입과 컬럼 자체는 삭제하지 않는다. 단지 UI의 주 의존성에서 제외한다
- source별 수집기 개선이나 backfill은 이 Task 범위 밖이다

# Non-goals

- K-Startup / 고용24 수집기에서 `compare_meta`를 실제 채우는 작업
- 운영 DB backfill
- compare relevance 섹션 재설계
- compare 페이지 전체 레이아웃 재작성
- 신규 비교 API 추가

# Implementation Notes

- 우선 수정 대상은 `frontend/app/(landing)/compare/programs-compare-client.tsx`
- 필요하면 compare row 정의를 배열화해 현재 컬럼 기준으로 단순화한다
- `getText`와 별도로 `"데이터 미수집"` 전용 formatter helper를 추가할 수 있다
- `summary`와 `description`이 모두 있는 경우, `summary`를 우선 표기하고 `description`은 보조 설명 또는 별도 행에 둔다
- 인증 여부는 boolean 표시용 helper를 둔다
- 지원 링크는 본문 텍스트 비교보다 CTA 행 동작 유지가 더 중요하므로, 본문에서는 `"바로가기 가능"` / `"링크 없음"` 같은 요약 표기도 허용한다

# Edge Cases

- `skills`와 `tags`가 문자열일 수도 있으므로 현재 normalize helper를 재사용한다
- `description`이 지나치게 길면 줄 수 제한을 둔다
- `provider`와 `location`이 모두 비어 있는 K-Startup row도 있을 수 있으므로 UI가 깨지지 않아야 한다
- `is_certified`가 `false` default인 source와 truly unknown source를 혼동하지 않도록, 데이터 계약을 먼저 확인한 뒤 `false`를 그대로 `미인증`으로 보여줄지 검토한다
- `application_url`이 계속 비어 있는 source는 본문/CTA에서 fallback link 정책을 일관되게 맞춘다

# Verification

- `git diff --check -- "frontend/app/(landing)/compare/programs-compare-client.tsx" "frontend/lib/types/index.ts"` 수행
- 가능하면 compare 페이지 수동 확인 또는 스냅샷 확인으로 기존 `정보 없음` 대량 노출이 줄었는지 검증

# Transport Notes

- Review source: `cowork/packets/TASK-2026-04-20-1532-compare-current-columns.md`
- Promotion target: `tasks/inbox/TASK-2026-04-20-1532-compare-current-columns.md`
- 실행 전 현재 HEAD가 `b994efe8e9ba084b7a73e601bec0a3e7a8b7872f`인지 확인한다
