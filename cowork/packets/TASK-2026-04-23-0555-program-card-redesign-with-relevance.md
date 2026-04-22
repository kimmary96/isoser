---
id: TASK-2026-04-23-0555-program-card-redesign-with-relevance
status: queued
type: feature
title: 프로그램 카드 리디자인과 관련도 근거 표시
priority: P1
planned_by: Claude (planning session)
planned_at: 2026-04-23T05:55:00+09:00
planned_against_commit: 7609401e9dc6eca716ca6fc3ea313e03eea0a357
depends_on: []
---

# Goal

프로그램 목록 카드의 액션 버튼을 제거하고 찜 버튼만 남깁니다. 관련도 점수를 숫자와 자연어 근거 최대 3줄로 노출합니다. `compare-relevance`와 `/programs/recommend` 응답에는 근거 문구 생성에 필요한 `relevance_reasons`, `score_breakdown`, `relevance_grade`, `relevance_badge`를 추가합니다.

이번 task는 Task 2보다 먼저 진행되는 선행 작업입니다. 현재 baseline에는 주소/지역 관련 in-flight 변경이 포함될 수 있으므로, 구현자는 기존 `region_match_score`, `matched_regions`, 주소 정규화 타입을 제거하지 않습니다. 다만 이 task의 핵심 산출물은 카드 UI와 관련도 설명 필드 안정화이며, 지역 가중치 튜닝과 주소 기반 점수 정책 변경은 Task 2에서 처리합니다.

# Dependencies

- 선행 의존성: 없음
- 후행 의존성: Task 2 `TASK-2026-04-23-0556-address-field-and-region-matching`는 이 task의 응답 스키마가 안정화된 뒤 진행해야 합니다.
- 병렬 가능: Task 3 `TASK-2026-04-23-0557-programs-listing-page-restructure`와 병렬 진행 가능합니다. 단, 카드 컴포넌트 충돌 가능성은 review 단계에서 확인해야 합니다.

# Execution Scope

우선 확인할 파일:

- `backend/routers/programs.py`
- `backend/rag/programs_rag.py`
- `frontend/app/api/programs/compare-relevance/route.ts`
- `frontend/app/api/dashboard/recommended-programs/route.ts`
- `frontend/app/api/dashboard/bookmarks/[programId]/route.ts`
- `frontend/app/(landing)/programs/page.tsx`
- `frontend/app/(landing)/programs/recommended-programs-section.tsx`
- `frontend/app/(landing)/programs/programs-filter-bar.tsx`
- `frontend/lib/types/index.ts`
- `frontend/lib/api/app.ts`

# User Flow

1. 유저가 `/programs`에 진입합니다.
2. 로그인 유저는 맞춤 추천 영역에서 관련도 40점 이상 프로그램을 확인합니다.
3. 관련도 80점 이상 카드는 상단에 우선 노출되고, 관련도 숫자와 근거 문구 최대 3개가 함께 표시됩니다.
4. 관련도 40점 미만 프로그램은 맞춤 추천 섹션에서 제외됩니다.
5. 카드 우측 상단 별 버튼 클릭 시 찜 상태가 토글됩니다.
6. 카드 본문 영역 클릭 시 프로그램 상세 페이지로 이동합니다.

# UI Requirements

- 범위 안 카드:
  - 공개 프로그램 목록 카드: `frontend/app/(landing)/programs/page.tsx`
  - 공개 맞춤 추천 섹션 카드: `frontend/app/(landing)/programs/recommended-programs-section.tsx`
- 범위 밖 카드:
  - 대시보드 캘린더 추천 카드와 프로그램 상세 페이지 카드는 이번 task에서 변경하지 않습니다.
- 범위 안 카드 우측 상단에는 별 버튼만 유지합니다.
- 기존 카드 액션인 `상세 보기`, `비교에 추가`, `지원 링크` 버튼은 범위 안 목록 카드에서 제거합니다.
- 별 버튼은 카드 클릭 이벤트와 분리하고 이벤트 버블링을 차단합니다.
- 카드 본문 영역은 상세 페이지로 이동하는 클릭 영역으로 동작합니다.
- 관련도 뱃지는 아래 기준으로 표시합니다.
  - 80~100: `딱 맞아요`
  - 60~79: `추천`
  - 40~59: `조건 일치`
- 근거 문구는 최대 3개만 표시합니다.
- 근거 문구 후보는 기여도 8점 이상 요소로 제한하고, 기여도 내림차순으로 정렬합니다.
- 동일 기여도일 때 우선순위는 희망 직무, 스킬, 경험, 지역, 준비도, 행동 신호 순서입니다.
- 빈 데이터는 라인 자체를 숨깁니다.
- `프로그램 소개가 아직 등록되지 않았습니다`, `일정 추후 공지`, `지역 정보 없음`, `태그 정보 없음` 같은 placeholder 문구는 목록 카드에 노출하지 않습니다.
- 불가피하게 출처 갱신 대기 상태를 보여야 할 때는 `HRD넷 업데이트 예정`처럼 출처 기준 문구를 사용합니다.
- 필수 필드인 제목, 마감일, 출처가 누락된 프로그램은 카드로 노출하지 않습니다.

# Relevance Requirements

점수 단위:

- API 응답의 `relevance_score`는 기존 호환성을 위해 현재 코드의 단위를 유지합니다.
- 현재 코드가 `0..1` float을 반환하는 경로에서는 필터 임계값을 `0.4`, `0.6`, `0.8`로 적용합니다.
- 현재 코드가 `0..100` number를 반환하는 경로에서는 필터 임계값을 `40`, `60`, `80`으로 적용합니다.
- 프론트 표시는 항상 퍼센트로 정규화합니다. `value <= 1`이면 `value * 100`, 그 외에는 그대로 퍼센트로 간주합니다.
- 신규 `score_breakdown`은 `0..100` 기준 기여 점수로 반환합니다. UI는 기본적으로 breakdown을 직접 노출하지 않습니다.

주소 필드 추가 전 임시 가중치를 사용합니다.

| 요소 | 가중치 |
|---|---:|
| 희망 직무 일치 | 35 |
| 보유 스킬 일치 | 30 |
| 경험 도메인 일치 | 20 |
| 거주 지역 일치 | 0 |
| 준비도 | 10 |
| 행동 신호 | 5 |

근거 문구는 템플릿 기반으로 생성하고, LLM 호출은 최소화합니다.

예시 템플릿:

- 희망 직무: `내 희망 직무 '{target_job}'와 일치`
- 스킬: `{skill_list} {n}개 스킬 매칭`
- 경험: `{domain} 관련 활동 {n}건 보유` 또는 `내 프로젝트 '{activity_title}'와 같은 분야`
- 준비도: `자격증 {n}개 + 활동 {m}건으로 중급 과정에 적합` 또는 `첫 국비 과정으로 추천`
- 행동: `최근 북마크한 {category} 과정들과 유사`
- 지역: Task 2에서 활성화합니다. 예: `{sido} 거주 지역과 일치`, `온라인 과정으로 지역 무관`

# Acceptance Criteria

1. 목록 카드에서 `상세 보기`, `비교에 추가`, `지원 링크` 버튼이 더 이상 노출되지 않습니다.
2. 카드 우측 상단 별 버튼으로 찜 토글이 가능합니다.
3. 별 버튼 클릭은 카드 상세 이동을 트리거하지 않습니다.
4. 카드 본문 클릭 시 프로그램 상세 페이지로 이동합니다.
5. `compare-relevance` 응답에 `relevance_reasons`, `score_breakdown`, `relevance_grade`, `relevance_badge`가 포함됩니다.
6. 기존 응답 필드인 `relevance_score`, `matched_skills`, `fit_label`, `fit_summary`, `readiness_label`, `gap_tags` 등은 유지됩니다.
7. `/programs/recommend` 응답에도 동일한 관련도 확장 필드가 포함됩니다.
8. 관련도 40점 미만 프로그램은 맞춤 추천 섹션에 노출되지 않습니다.
9. 프로필과 활동이 모두 비어있는 유저는 맞춤 추천 카드 대신 CTA 안내를 봅니다.
10. 빈 상태 placeholder 문구가 목록 카드에 노출되지 않습니다.
11. 제목, 마감일, 출처 중 하나라도 누락된 프로그램은 목록 카드에서 제외됩니다.
12. 기존 비교 페이지의 `compare-relevance` 사용처가 깨지지 않습니다.
13. 추천 캐시 또는 fallback/default 추천 경로에서도 신규 관련도 필드는 누락되지 않거나 안전한 기본값으로 채워집니다.
14. 북마크 토글은 backend `POST /bookmarks/{program_id}` / `DELETE /bookmarks/{program_id}`를 브라우저에서 직접 호출하지 않고, `frontend/app/api/dashboard/bookmarks/[programId]/route.ts` BFF mutation route를 사용합니다. 해당 route가 없거나 불완전하면 이 경로로 최소 구현합니다.

# Constraints

- 기존 동작 유지가 최우선입니다.
- 이번 task에서는 주소 필드를 새로 도입하지 않습니다.
- 이미 baseline에 있는 지역 관련 응답 필드와 타입은 보존합니다. 단, 지역 가중치 정책 변경과 주소 기반 점수 튜닝은 Task 2 범위로 남깁니다.
- 기존 API 응답 필드는 제거하거나 이름을 바꾸지 않습니다.
- 신규 필드는 기존 `fit_label`, `fit_summary`, `readiness_label`, `gap_tags`를 대체하지 않고 병행 제공하는 호환 확장입니다.
- 관련도 근거 문구는 템플릿 기반으로 생성합니다.
- 카드 전체 클릭 영역화 시 별 버튼 영역은 이벤트 버블링을 차단합니다.
- `programs.skills`가 운영 데이터에서 비어있는 현실을 고려해 `title`, `summary`, `description`, `compare_meta` 텍스트 토큰 fallback을 유지하거나 활용합니다.
- 현재 `docs/current-state.md`에는 `compare-relevance`가 이미 `fit_label`, `fit_summary`, `readiness_label`, `gap_tags`를 반환한다고 기록되어 있습니다. 구현 전 기존 응답을 확인하고 중복 필드 생성 대신 호환 확장을 우선합니다.
- 카드 노출 자격의 필수 필드는 아래처럼 정의합니다.
  - 제목: `title`이 비어있지 않아야 합니다.
  - 마감일: 모집 마감일 기준의 `deadline` 또는 이미 정규화된 `close_date`가 있어야 합니다. 고용24 훈련 종료일 성격의 `end_date`만 있는 경우 마감일로 간주하지 않습니다.
  - 출처: `source`가 비어있지 않아야 합니다. `provider`는 표시 보조값이며 source 대체 필수값으로 보지 않습니다.

# Non-goals

- 주소 필드 마이그레이션
- 지역 매칭 점수 계산
- 프로그램 목록 필터 보강
- 정렬 옵션 추가
- 목록 페이지 섹션 분리
- 비로그인 유저 맞춤 추천 블러 처리
- collector/normalizer의 `programs.skills` 추출 로직 개선
- 비교 페이지 전체 UX 재설계

# Edge Cases

- 프로필과 활동이 모두 비어있는 유저는 맞춤 추천 섹션에 CTA 안내를 노출합니다.
- 직무만 있고 스킬이 없는 유저는 직무/경험 중심으로 재가중하되, 주소 기반 지역 재가중은 Task 2 이후 적용합니다.
- 활동만 있고 프로필이 비어있는 유저는 `activities.skills`를 사용자 스킬 후보로 간주합니다.
- `programs.skills`가 비어있는 프로그램은 제목, 요약, 설명, 비교 메타 텍스트 토큰 fallback을 사용합니다.
- 프론트 경계에서 `programs.skills`가 `string[]`, `string`, `null` 세 형태로 올 수 있으므로 파싱 방어 코드를 유지합니다.
- 관련도 점수가 동점이면 희망 직무, 스킬, 경험, 지역, 준비도, 행동 신호 순서의 breakdown 우선순위로 정렬합니다.
- 추천 API 또는 관련도 API가 실패하면 기존 프로그램 목록 자체는 유지되어야 합니다.

# Open Questions

- 근거 문구 템플릿을 둘 위치는 구현자가 현재 구조를 확인한 뒤 결정합니다. 추정 후보는 backend relevance/recommendation 관련 모듈의 신규 helper입니다.
- 프론트 카드 컴포넌트 위치는 현재 `/programs` 구조를 확인한 뒤 결정합니다.
- 기존 `fit_label`, `fit_summary`, `readiness_label`, `gap_tags`와 신규 `relevance_grade`, `relevance_badge`, `relevance_reasons`의 UI 병행 노출 여부를 구현 전 확인해야 합니다.
- 찜 기반 비교 페이지 연결은 목록 카드에서 버튼을 제거하되, 기존 비교 페이지 진입 경로가 충분한지 확인이 필요합니다.

## Auto Recovery Context

- source_task: `tasks/blocked/TASK-2026-04-23-0555-program-card-redesign-with-relevance.md`
- failure_stage: `blocked`
- failure_report: `reports/TASK-2026-04-23-0555-program-card-redesign-with-relevance-blocked.md`
- recovery_report: `reports/TASK-2026-04-23-0555-program-card-redesign-with-relevance-recovery.md`
- reviewer_action: review the verification findings, tighten the packet if needed, and only then approve requeueing
