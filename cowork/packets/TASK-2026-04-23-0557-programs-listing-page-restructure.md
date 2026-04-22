---
id: TASK-2026-04-23-0557-programs-listing-page-restructure
status: proposed
type: feature
title: 프로그램 목록 페이지 섹션 구조와 필터 정렬 개편
priority: P2
planned_by: Claude (planning session)
planned_at: 2026-04-23T05:57:00+09:00
planned_against_commit: eb7a6d7e2828c76abf682fe0f478c538d3cd397e
planned_files: frontend/app/(landing)/programs/page.tsx, frontend/app/(landing)/programs/programs-filter-bar.tsx, frontend/app/(landing)/programs/recommended-programs-section.tsx, frontend/lib/types/index.ts, frontend/lib/api/backend.ts, backend/routers/programs.py
depends_on: []
---

# Goal

프로그램 목록 페이지를 `맞춤 추천`, `마감 임박`, `전체 프로그램` 세 섹션으로 개편합니다. 부트캠프 의사결정에 필요한 필터를 보강하고, 정렬 옵션을 추가하며, 비로그인 유저에게는 맞춤 추천 섹션을 블러 처리한 뒤 로그인 CTA를 노출합니다.

이 task는 Task 1과 병렬 진행 가능한 독립 task입니다. 다만 최종 통합 시 Task 1의 카드 디자인과 관련도 응답 필드를 재사용해야 합니다. Task 1이 아직 승인되지 않은 상태에서는 `relevance_reasons`와 `relevance_badge` 같은 신규 필드에 강하게 의존하지 말고, 현재 존재하는 `relevance_score`, `reason`, `fit_label`, `fit_summary` 기반으로 먼저 동작하게 합니다.

# Dependencies

- 선행 의존성: 없음
- 병렬 가능: Task 1 `TASK-2026-04-23-0555-program-card-redesign-with-relevance`와 병렬 진행 가능합니다.
- 통합 의존성: Task 1 완료 후에는 동일 카드 컴포넌트와 `relevance_score`, `relevance_reasons`, `relevance_badge` 표시 정책을 맞춰야 합니다.
- 직접 무관: Task 2 `TASK-2026-04-23-0556-address-field-and-region-matching`의 주소/지역 매칭 구현과 직접 의존하지 않습니다.

# Current-State Caution

`docs/current-state.md` 기준으로 현재 `/programs`는 이미 검색, 카테고리, 세부 카테고리, 지역, 수업 방식, 비용, 참여 시간, 모집중 토글, 정렬, 페이지네이션을 지원합니다. 따라서 구현자는 이 task를 전면 신규 구현으로 보지 말고, 기존 필터/정렬/페이지네이션 구조를 재사용하면서 부족한 의사결정 필터와 섹션 구조만 보완해야 합니다.

현재 `RecommendedProgramsSection`도 이미 존재합니다. 이 task는 해당 섹션을 새로 만드는 작업이 아니라, 기존 섹션을 블러 CTA와 카드 수/섹션 구조 요구사항에 맞게 수정하는 작업입니다.

# User Flow

비로그인 유저:

1. `/programs`에 진입합니다.
2. 상단에 맞춤 추천 섹션이 블러 처리된 상태로 보입니다.
3. 블러 영역 위에 `로그인하고 내 맞춤 추천 받기` CTA가 노출됩니다.
4. 마감 임박 섹션과 전체 프로그램 섹션은 정상 사용 가능합니다.
5. 검색, 필터, 정렬, 모집 중 토글을 사용할 수 있습니다.
6. CTA 클릭 시 로그인 페이지로 이동하고, 로그인 후 맞춤 추천을 사용할 수 있습니다.

로그인 유저:

1. `/programs`에 진입합니다.
2. 맞춤 추천 섹션에서 관련도 40점 이상 프로그램을 관련도 높은 순으로 확인합니다.
3. 마감 임박 섹션에서 D-7 이내 프로그램을 확인합니다.
4. 전체 프로그램 섹션에서 검색, 필터, 정렬, 페이지네이션을 사용합니다.
5. 모집 중만 보기 토글로 전체 결과와 모집중 결과를 전환합니다.

# UI Requirements

필터/정렬 적용 범위:

- 검색, 필터, 정렬, 모집중 토글, 페이지네이션은 기본적으로 `전체 프로그램` 섹션에 적용합니다.
- `마감 임박` 섹션은 현재 query의 검색/필터 조건 중 프로그램 속성 필터는 공유하되, 정렬은 항상 D-day 오름차순입니다.
- `맞춤 추천` 섹션은 로그인 상태와 추천 API 결과를 우선하며, 전체 프로그램의 페이지네이션에는 영향을 받지 않습니다.
- 전체 프로그램 정렬이나 페이지 변경은 맞춤 추천 섹션의 결과를 재페이지네이션하지 않습니다.

필터 영역:

- 기존 필터는 유지합니다.
- 1순위로 선발 절차, 채용 연계 필터를 추가합니다.
- 2순위로 운영 기관, 추천 대상 필터를 추가합니다.
- 우수훈련기관 뱃지 필터는 데이터 확보 후 활성화 가능한 구조만 고려하고, 실제 데이터가 없으면 노출하지 않습니다.
- 필터는 현재 프로그램 목록의 UI 패턴에 맞춰 드롭다운 또는 반응형 대체 UI로 구현합니다.
- 필터 상태는 URL query parameter에 반영합니다.

필터 query/field 매핑:

- 선발 절차: query `selection_process`, source `compare_meta.selection_process` 또는 텍스트 fallback. 데이터가 없으면 UI에 노출하지 않고 follow-up으로 남깁니다.
- 채용 연계: query `employment_link`, source `compare_meta.employment_link`, `compare_meta.hiring_benefit`, `compare_meta.internship_link` 또는 텍스트 fallback. 데이터가 없으면 UI에 노출하지 않고 follow-up으로 남깁니다.
- 운영 기관: query `sources`, source `source` 우선, 표시 보조값은 `provider`를 사용합니다.
- 추천 대상: query `targets`, source `target` 우선, 없으면 `compare_meta.target_group`을 사용합니다. 데이터가 없으면 UI에 노출하지 않고 follow-up으로 남깁니다.

정렬 영역:

- 정렬 query 값은 아래로 고정합니다.
  - `recommended`: 맞춤 추천순
  - `deadline`: 마감 임박순
  - `latest`: 최신순
  - `popular`: 인기순, Phase 2
- 백엔드 `sort` query는 최소 `deadline`, `latest`, `recommended`를 허용합니다.
- 로그인 유저의 `recommended`는 relevance 점수가 있는 경우 관련도 내림차순, 동점이면 마감일 오름차순입니다.
- 비로그인 또는 relevance 데이터가 없는 경우 `recommended`는 `deadline`으로 fallback합니다.
- 인기순은 북마크 집계 인프라가 확인된 경우에만 활성화하고, 준비되지 않았으면 Phase 2로 남깁니다.
- 로그인 유저 기본 정렬은 맞춤 추천순을 우선 검토합니다.
- 비로그인 유저 기본 정렬은 마감 임박순을 유지합니다.
- 모집 중만 보기 토글을 유지하거나 보강합니다.

섹션 구조:

- 섹션 1: 맞춤 추천
- 섹션 2: 마감 임박
- 섹션 3: 전체 프로그램
- 각 섹션 헤더에는 표시 카드 수를 노출합니다.
- 마감 임박 섹션은 D-7 이내 프로그램만 표시합니다.
- 마감 임박 결과가 없으면 섹션 자체를 숨깁니다.
- 전체 프로그램 섹션에는 기존 페이지네이션을 유지합니다.

비로그인 처리:

- 맞춤 추천 섹션은 블러 처리된 카드 3장과 CTA 오버레이를 표시합니다.
- 블러 카드에는 개인화 추천 결과를 사용하지 않습니다.
- CTA 클릭 시 `/login?redirectedFrom=<encoded current /programs path with query>`로 이동합니다.
- 로그인 후 가능한 경우 기존 `/programs` query string을 유지합니다.

# Acceptance Criteria

1. 필터에 선발 절차 옵션이 추가되거나, 데이터 부재 시 비노출 사유가 명확히 처리됩니다.
2. 필터에 채용 연계 옵션이 추가되거나, 데이터 부재 시 비노출 사유가 명확히 처리됩니다.
3. 필터에 운영 기관 옵션이 추가됩니다.
4. 필터에 추천 대상 옵션이 추가되거나, 데이터 부재 시 비노출 사유가 명확히 처리됩니다.
5. 필터 변경 시 결과 카운트가 현재 페이지 상태에 맞게 업데이트됩니다.
6. 정렬 옵션에 맞춤 추천순, 마감 임박순, 최신순이 포함됩니다.
7. 정렬 변경 시 카드 순서가 즉시 재정렬되고 URL query parameter에 반영됩니다.
8. 모집 중만 보기 토글이 기존 동작을 유지하면서 섹션 구조에서도 정상 동작합니다.
9. 페이지가 맞춤 추천, 마감 임박, 전체 프로그램 세 섹션으로 분리됩니다.
10. 각 섹션 헤더에 카드 수가 표시됩니다.
11. 비로그인 유저는 맞춤 추천 섹션을 블러 처리된 상태와 CTA로 봅니다.
12. 비로그인 유저가 CTA 클릭 시 로그인 페이지로 이동합니다.
13. 로그인 후 맞춤 추천 섹션이 정상 노출됩니다.
14. 기존 페이지네이션과 검색 query 동작은 깨지지 않습니다.
15. 제목, 마감일, 출처 중 하나라도 누락된 프로그램은 모든 섹션에서 노출되지 않습니다.
16. 필수 필드 기준은 `title`, 모집 마감일 `deadline` 또는 `close_date`, 출처 `source`입니다. `end_date` 단독 값은 모집 마감일로 간주하지 않고, `provider`는 source의 표시 보조값입니다.
17. 비로그인 추천 CTA는 현재 query string을 포함한 `/programs` 경로를 `redirectedFrom`으로 보존합니다.

# Constraints

- 기존 `/programs` 검색, 필터, 정렬, 페이지네이션 동작을 최대한 재사용합니다.
- Task 1의 카드 디자인을 최종적으로 사용해야 합니다. 병렬 작업 중에는 카드 컴포넌트 충돌을 최소화합니다.
- URL query parameter 기반 상태 공유와 뒤로 가기 동작을 유지합니다.
- 비로그인 블러 처리 시 개인화 추천 데이터를 노출하지 않습니다.
- 인기순 정렬은 북마크 집계 인프라가 확인되기 전에는 비활성 또는 후속 phase로 남깁니다.
- 필수 필드 누락 프로그램 제외 규칙은 Task 1과 동일하게 적용합니다.
- 기존 목록 API가 지원하지 않는 필터는 프론트 임시 필터로 무리하게 숨기기보다 백엔드 지원 여부를 확인하고 최소 안전 변경으로 확장합니다.
- 대규모 라우트 재작성보다 현재 파일 구조 내 점진적 개선을 우선합니다.
- Task 1의 신규 관련도 필드가 아직 없으면 현재 존재하는 추천 응답 필드로 섹션 구조를 먼저 구현하고, 신규 근거 UI는 Task 1 통합 시 연결합니다.

# Non-goals

- 카드 디자인 자체 변경
- 관련도 점수 계산 로직 구현
- `compare-relevance` 또는 `/programs/recommend` 응답 스키마 변경
- 주소 필드와 지역 매칭 구현
- 우수훈련기관 데이터 수집 인프라 구현
- 필터 결과를 무한 스크롤로 전환
- collector/normalizer 대규모 개편
- 비교 페이지 UX 재설계

# Edge Cases

- 필터 결과가 0개이면 `조건에 맞는 프로그램이 없습니다` 빈 상태와 필터 초기화 CTA를 제공합니다.
- 로그인 유저의 맞춤 추천 결과가 0개이면 `프로필을 더 채우면 맞춤 추천이 향상돼요` 성격의 CTA를 제공합니다.
- 마감 임박 결과가 0개이면 섹션 자체를 숨깁니다.
- 정렬 변경 시 페이지 번호는 1로 리셋합니다.
- 비로그인 유저가 필터 사용 중 로그인하면 가능한 한 기존 필터 query를 유지합니다.
- URL query parameter가 손상되면 기본값으로 fallback합니다.
- 모바일에서는 필터가 화면을 밀어내거나 겹치지 않도록 현재 반응형 패턴에 맞춰 칩, 가로 스크롤, 또는 바텀시트 중 하나를 사용합니다.
- 데이터 소스에 선발 절차, 채용 연계, 추천 대상 필드가 없으면 해당 필터를 무리하게 노출하지 않고 Open Questions 또는 follow-up으로 남깁니다.

# Open Questions

- 비로그인 블러 카드에 더미 데이터를 사용할지, 개인화가 아닌 인기/마감 임박 실제 프로그램을 사용할지 결정이 필요합니다. 권장은 개인화가 아닌 실제 공개 프로그램입니다.
- 선발 절차, 채용 연계, 추천 대상 필터의 데이터 소스가 현재 `programs` 테이블 또는 `compare_meta`에 충분히 존재하지 않으면 해당 필터는 이번 구현에서 비노출하고 후속 task로 분리합니다.
- 운영 기관 옵션은 현재 `source` 값을 기준으로 생성하고, 화면 표시에는 `provider`를 보조로 사용할 수 있습니다.
- 모바일 필터 UX는 현재 `programs-filter-bar` 패턴을 확인한 뒤 결정해야 합니다.
- Task 1과 병렬 진행 시 카드 컴포넌트 변경 충돌을 어떻게 나눌지 review 단계에서 조율해야 합니다.
