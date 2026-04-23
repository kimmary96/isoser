---
id: TASK-2026-04-23-0556-address-field-and-region-matching
status: queued
type: feature
title: 주소 필드와 지역 매칭 점수 활성화
priority: P2
planned_by: Claude (planning session)
planned_at: 2026-04-23T05:56:00+09:00
planned_against_commit: 7609401e9dc6eca716ca6fc3ea313e03eea0a357
depends_on:
  - TASK-2026-04-23-0555-program-card-redesign-with-relevance
---

# Goal

`profiles`에 주소 관련 필드를 추가하고 프로필 입력 폼에 주소 입력 UI를 반영합니다. 백엔드에는 주소 정규화 유틸과 지역 매칭 점수 계산을 추가합니다. Task 1에서 안정화한 관련도 응답 스키마에 `score_breakdown.region`과 지역 근거 문구를 연결하고, 관련도 가중치를 임시 가중치에서 최종 가중치로 전환합니다.

# Dependencies

- 선행 필요: Task 1 `TASK-2026-04-23-0555-program-card-redesign-with-relevance`
- 이유: Task 1에서 `score_breakdown`, `relevance_reasons`, `relevance_grade`, `relevance_badge` 응답 스키마가 먼저 안정화되어야 지역 점수를 같은 계약에 안전하게 추가할 수 있습니다.
- 병렬 불가: 이 task는 Task 1 완료 전 구현하지 않습니다.
- 독립/병렬 관계: Task 3 `TASK-2026-04-23-0557-programs-listing-page-restructure`와는 직접 의존성이 없습니다.

# Execution Scope

우선 확인할 파일:

- `supabase/migrations/20260423100000_add_address_to_profiles.sql`
- `frontend/app/api/dashboard/profile/route.ts`
- `frontend/app/dashboard/profile/_components/profile-edit-modal.tsx`
- `frontend/app/dashboard/profile/_components/profile-hero-section.tsx`
- `frontend/app/dashboard/profile/_hooks/use-profile-page.ts`
- `frontend/app/dashboard/profile/page.tsx`
- `frontend/lib/types/index.ts`
- `backend/routers/programs.py`
- `backend/rag/programs_rag.py`
- 관련 테스트가 있으면 profile route, programs router, recommendation scoring 테스트를 함께 갱신합니다.

# Current-State Caution

`docs/current-state.md`에는 이미 `profiles`가 주소 원문(`address`)과 추천/매칭용 지역 정규화값(`region`, `region_detail`)을 저장할 수 있다고 기록되어 있습니다. 또한 현재 worktree에는 주소 관련 migration과 프로필 UI/API 변경 파일이 미커밋 상태로 존재할 수 있습니다.

따라서 이 task는 새 구현 task가 아니라 현재 baseline의 주소/지역 구현을 기준으로 한 fix/update task로 취급합니다. 구현자는 먼저 현재 코드와 DB migration을 확인하고, 이미 만족한 항목은 재구현하지 않으며, 남은 gap만 보완합니다.

# User Flow

1. 유저가 프로필 설정 또는 프로필 편집 화면에 진입합니다.
2. 주소 입력 필드에 시/도 수준을 포함한 주소를 입력합니다.
3. 저장 시 서버가 주소 원문에서 시/도 정규화 값을 산출합니다.
4. 주소 원문과 정규화된 지역 값이 프로필에 저장됩니다.
5. 이후 `/programs` 맞춤 추천에서 지역 매칭 점수가 반영됩니다.
6. 지역 매칭이 의미 있는 경우 근거 문구에 `서울 거주 지역과 일치` 같은 시/도 수준 문구가 노출됩니다.

# UI Requirements

- 프로필 입력/편집 폼에 주소 입력 필드를 추가하거나, 이미 있다면 기존 UI를 유지하며 누락 동작만 보완합니다.
- 주소 입력 위치는 경력·학력 등 기본 프로필 정보 근처를 우선 검토합니다.
- 입력 방식은 자유 입력 또는 시/도 드롭다운 중 구현자가 현재 UI 패턴에 맞게 선택합니다.
- 저장 후 화면에는 주소 원문 전체 대신 시/도 또는 시/군/구 수준의 정규화 지역만 노출합니다.
- 맞춤 추천 근거 문구에는 시/도 단위까지만 노출합니다.
- 구/동 단위 상세 주소는 추천 근거 문구에 노출하지 않습니다.

# Relevance Requirements

Task 1의 임시 가중치를 아래 최종 가중치로 전환합니다.

| 요소 | 최종 가중치 |
|---|---:|
| 희망 직무 일치 | 30 |
| 보유 스킬 일치 | 25 |
| 경험 도메인 일치 | 15 |
| 거주 지역 일치 | 15 |
| 준비도 | 10 |
| 행동 신호 | 5 |

지역 점수 규칙:

| 상황 | 점수 |
|---|---:|
| 프로그램 운영 지역과 유저 시/도 완전 일치 | 15 |
| 인접 시/도 | 10 |
| 온라인 프로그램 | 12 |
| 혼합형 프로그램 | 10 |
| 원격지 오프라인 | 0 |
| 유저 주소 미입력 | 지역 요소 제외 후 재가중 |

프로그램 지역 필드 우선순위:

1. 정규화된 `region`
2. 표시용 `location`
3. `compare_meta.region`, `compare_meta.location`, `compare_meta.address`
4. 위 값이 모두 없으면 지역 매칭 불가

온라인/혼합형 판정:

1. 명시 필드 `teaching_method` 또는 동등 필드에 `온라인`이 있으면 온라인으로 판정합니다.
2. `온라인`과 `오프라인` 또는 지역명이 함께 있으면 혼합형으로 판정합니다.
3. 명시 필드가 없으면 `title`, `summary`, `description`, `compare_meta` 텍스트에서 `온라인`, `비대면`, `혼합`, `블렌디드`, `오프라인` 키워드를 보수적으로 확인합니다.

인접 시/도 1차 규칙:

- 수도권: 서울, 경기, 인천은 서로 인접으로 봅니다.
- 충청권: 대전, 세종, 충북, 충남은 서로 인접으로 봅니다.
- 동남권: 부산, 울산, 경남은 서로 인접으로 봅니다.
- 대구·경북권: 대구, 경북은 서로 인접으로 봅니다.
- 광주·전라권: 광주, 전북, 전남은 서로 인접으로 봅니다.
- 강원과 제주는 1차 구현에서는 완전 일치만 인정합니다.

주소 미입력 재가중:

- 지역 요소를 제외하고 Task 1 임시 가중치와 동일하게 직무 35, 스킬 30, 경험 20, 준비도 10, 행동 5로 계산합니다.
- breakdown은 정수 반올림 기준으로 합계가 UI 표시 점수와 크게 어긋나지 않게 조정합니다.

# Acceptance Criteria

1. `profiles` 테이블에 주소 원문과 추천/매칭용 정규화 지역을 저장할 수 있습니다.
2. 기존 유저 데이터는 NULL 허용 또는 안전한 fallback으로 깨지지 않습니다.
3. 기존 migration 파일을 수정하지 않고 필요한 경우 새 SQL migration 파일만 추가합니다.
4. 프로필 폼에서 주소 입력, 수정, 저장이 가능합니다.
5. 백엔드 또는 BFF가 주소 원문에서 시/도 정규화 값을 산출합니다.
6. 관련도 가중치가 임시 가중치에서 최종 가중치로 전환됩니다.
7. 지역 매칭 점수가 `score_breakdown.region`에 최대 15점으로 반영됩니다.
8. 주소가 있는 유저는 지역 매칭 근거 문구가 `relevance_reasons`에 포함될 수 있습니다.
9. 주소가 없는 유저는 Task 1의 임시 가중치와 동일한 방식으로 지역 가중치를 다른 요소에 재분배합니다.
10. 시/도 완전 일치는 15점, 인접 시/도는 10점으로 계산됩니다.
11. 온라인 프로그램은 지역 무관 가점 12점을 적용합니다.
12. 혼합형 프로그램은 10점을 적용합니다.
13. 근거 문구에는 시/도 단위까지만 노출되고 구/동 단위는 노출되지 않습니다.
14. 이미 주소 필드와 정규화 로직이 구현되어 있다면 중복 구현하지 않고 누락된 acceptance만 보완합니다.
15. 최소 검증은 profile 주소 저장/표시, 주소 정규화, 주소 미입력 fallback, 온라인/혼합형 지역 점수, 상세 주소 비노출을 포함합니다.

# Constraints

- 주소는 민감 정보로 취급합니다.
- 근거 문구에서 상세 주소, 구/동, 도로명, 지번은 노출하지 않습니다.
- 기존 migration 파일은 수정하지 않습니다.
- `@supabase/ssr` 기반 쿠키 세션 흐름을 유지합니다.
- Task 1의 관련도 응답 필드와 호환되어야 합니다. 실행 큐에서는 Task 1이 먼저 처리된다는 전제이며, Task 1 결과가 없으면 구현자는 이 task를 drift로 중단합니다.
- 주소 정규화 사전은 국내 17개 시/도 기준으로 시작합니다.
- 프로그램 측 지역 데이터가 불완전할 수 있으므로 지역 매칭 실패가 전체 추천 실패로 이어지면 안 됩니다.
- 현재 worktree에 주소 관련 미커밋 변경이 있으므로, 구현 전 `git status`, migration, 프로필 API, 프로필 UI를 반드시 확인합니다.

# Verification Targets

- 프로필 주소 저장: `frontend/app/api/dashboard/profile/route.ts`
- 주소 입력 UI와 저장 flow: `profile-edit-modal.tsx`, `use-profile-page.ts`
- 정규화 지역 표시: `profile-hero-section.tsx`
- region breakdown 및 no-address fallback: `backend/routers/programs.py`
- 온라인/혼합형 점수: programs recommendation 또는 compare relevance 관련 테스트
- 개인정보 보호: 근거 문구와 UI에 상세 주소가 노출되지 않는지 확인

# Non-goals

- 구/동 단위 정밀 매칭
- 지하철역, 통학 시간, 교통편 정보 계산
- 주소 자동완성 API 연동
- 프로그램 측 지역 메타데이터 대규모 보강
- collector/normalizer의 지역 데이터 수집 전면 개편
- Task 1의 카드 UI 재작업
- Task 3의 필터/정렬/섹션 구조 개편

# Edge Cases

- 주소 미입력 유저는 지역 점수를 계산하지 않고 나머지 요소로 재가중합니다.
- 해외 주소 또는 정규화 불가 주소는 지역 매칭 불가로 처리하고 근거 문구에서 제외합니다.
- 프로그램 측 지역 데이터가 비어있으면 지역 점수 0점 또는 요소 제외 중 현재 scorer 정책에 맞는 보수적 fallback을 적용합니다.
- 세종시처럼 시/도와 시/군/구 경계가 특수한 지역은 별도 매핑 규칙을 둡니다.
- 온라인 프로그램에 오프라인 지역이 함께 표기된 경우 온라인/혼합형 여부를 우선 판정합니다.
- 유저가 상세 주소를 입력해도 UI와 근거 문구는 정규화 지역만 표시합니다.
- 주소 관련 migration이 이미 존재하면 새 migration 추가가 필요한지 먼저 판단합니다.

# Open Questions

- 주소 필드 최종 스키마는 구현 전 실제 migration과 타입을 확인해야 합니다. 기준 스키마는 `address`, `region`, `region_detail`입니다. 이미 다른 이름으로 구현된 경우 migration과 타입을 먼저 대조합니다.
- 프로필 UI는 자유 입력과 시/도 드롭다운 중 어떤 방식이 현재 UX에 더 맞는지 확인이 필요합니다.
- 현재 worktree의 주소 관련 변경이 이미 이 task를 대부분 만족한다면 result는 duplicate 또는 fix/update로 처리해야 합니다.
