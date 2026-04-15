---
id: TASK-2026-04-15-1040-programs-hub-delta
status: queued
type: feature
title: 프로그램 허브 델타 정렬 — 기존 /programs UX 고도화 + query/filter 정합성 보강
priority: high
planned_by: codex
planned_at: 2026-04-15T10:40:00+09:00
planned_against_commit: 18f05264b2336be828a13c0a56bf69cefba74520
---

# Goal

이미 존재하는 프로그램 허브 구현을 현재 저장소 기준으로 고도화한다.

이번 Task는 `programs` 도메인을 새로 만드는 작업이 아니다. 기존 구현인 아래 파일과 흐름을 기준선으로 삼아, 부족한 목록 경험과 query/filter surface를 보강하는 delta 작업이다.

- `frontend/app/programs/page.tsx`
- `frontend/app/programs/[id]/page.tsx`
- `backend/routers/programs.py`
- `backend/routers/admin.py`
- `frontend/middleware.ts`

핵심 목표는 다음 3가지다.

1. 기존 `/programs`를 공개 허브 페이지답게 검색·필터·정렬·페이지네이션이 되는 목록 화면으로 끌어올린다
2. 현재 프론트 query state와 백엔드 `GET /programs/` 필터 surface를 맞춘다
3. 기존 상세 페이지, 추천, 동기화, 인증 보호 범위를 깨지 않고 개선한다

# Current Baseline

구현 전 반드시 아래 사실을 전제로 작업한다.

- `programs` 관련 migration이 이미 존재한다. 새 base table 생성 금지
- `/programs` 목록 페이지가 이미 존재한다
- `/programs/[id]` 상세 페이지가 이미 존재한다
- 공개 `programs` router와 관리자 sync 로직이 이미 존재한다
- middleware 위치는 루트가 아니라 `frontend/middleware.ts`다
- `/`와 `/landing-a`에서 이미 `/programs`로 진입 가능하다

현재 코드상 확인된 갭은 다음과 같다.

- `/programs` UI가 카테고리 단일 필터 + 카드 목록 수준으로만 구현돼 있다
- 페이지네이션/총건수/검색/정렬/다중 지역 필터가 없다
- 프론트의 `PROGRAM_CATEGORIES`와 backend/program sync 쪽 category 체계가 일관되지 않는다
- 백엔드 `GET /programs/`는 `category`, `scope`, `region_detail`, `limit`, `offset`만 받는다
- 목록 화면이 페이지네이션과 필터 count를 만들기엔 응답 surface가 부족하다

# User Flow

- 비로그인 사용자가 `/programs`에 직접 접근하거나 랜딩에서 진입한다
- 상단 허브 헤더에서 전체 결과 수와 정렬 상태를 본다
- 검색어, 카테고리, 지역, 모집중 여부를 조합해 목록을 좁힌다
- 목록은 20건 단위로 페이지네이션되며 URL query로 현재 상태가 유지된다
- 카드 클릭 시 기존 `/programs/[id]` 상세 페이지로 이동한다
- 상세 페이지는 계속 동작해야 하며, 이번 Task에서 제거하거나 축소하지 않는다

# Scope

## In scope

- `frontend/app/programs/page.tsx`를 기존 route 그대로 개선
- 필요 시 `/programs` 전용 하위 컴포넌트/유틸 분리
- `frontend/lib/api/backend.ts`, `frontend/lib/types/index.ts`의 programs 관련 타입/호출 보강
- `backend/routers/programs.py`의 목록 조회 query surface 확장
- 필요한 경우에 한해 additive migration 1건 추가
- `docs/specs/api-contract.md` 갱신
- `docs/current-state.md`, `docs/refactoring-log.md` 업데이트
- `reports/TASK-2026-04-15-1040-programs-hub-delta-result.md` 작성

## Out of scope

- 새 `programs` base table 생성 또는 기존 migration rewrite
- `/programs/[id]` 신규 생성
- bookmarks 신규 도입 또는 대규모 재설계
- recommend 알고리즘 변경
- cron, scheduler, GitHub Actions 기반 자동 sync
- 광고 운영 로직
- `/` 또는 `/landing-a` 전면 개편

# Data And Schema Rules

- 기존 migration 파일 수정 금지
- `programs`를 새로 만드는 migration 추가 금지
- 스키마 변경이 정말 필요하면 additive migration만 허용한다
- additive migration은 기존 목록/상세/추천/sync 코드와 충돌하지 않아야 한다
- migration이 필요 없다면 만들지 않는다

특히 현재 저장소에는 `programs` 관련 migration이 복수 세대로 섞여 있으므로, 구현자는 "문서상 이상적 스키마"가 아니라 "현재 코드가 실제로 읽고 쓰는 컬럼" 기준으로 판단해야 한다.

이번 Task에서 우선 신뢰할 기준 컬럼은 아래다.

- `id`
- `title`
- `category`
- `location`
- `provider`
- `summary`
- `description`
- `application_url`
- `source`
- `source_url`
- `link`
- `deadline`
- `start_date`
- `end_date`
- `is_active`
- `is_ad`
- `hrd_id`
- `target`

`scope`, `region_detail`는 이미 코드에 존재하지만 실제 목록 UX에 쓸지 여부를 구현 시 재검토한다. 만약 `location` 기반 지역 필터가 더 안전하면 그쪽을 우선한다.

# Backend Requirements

`GET /programs/`는 현재 소비자를 깨지 않는 방향으로 확장한다.

필수 query 후보:

- `q`: 제목 기준 검색
- `category`: 단일 선택
- `regions`: 다중 선택. 구현 시 query encoding은 `regions=서울,경기` 또는 반복 파라미터 중 현재 코드에 더 안전한 방식으로 결정
- `recruiting_only`: 모집중만 보기
- `sort`: 최소 `deadline` / `latest`
- `limit`
- `offset`

정렬 규칙:

- `deadline`: 마감일 빠른 순, null은 뒤로
- `latest`: 생성일 또는 업데이트 기준 최신순. 구현 전 실제 컬럼 availability 확인

모집중 판정:

- 기존 `is_active`가 실제 모집 상태에 가까우면 우선 사용
- 필요 시 `deadline >= today`를 함께 사용하되, 현재 sync 데이터 품질을 보고 안전한 쪽을 선택
- 기준을 하나로 정하고 API contract와 코드에 명시

검색:

- `title` 기준 부분 검색
- 가능하면 Supabase 쿼리로 처리하고, 메모리 전체 로드 후 프론트 필터링은 피한다

페이지네이션/총건수:

- `/programs` 화면은 총건수가 필요하다
- 기존 소비자를 깨는 breaking change는 피한다
- 필요 시 아래 중 하나를 선택한다
  - non-breaking한 별도 BFF route 추가
  - 기존 endpoint는 유지하고 count 조회를 분리
  - 응답 shape를 바꾸지 않는 count 획득 방식 사용
- 어떤 방식을 택했는지 result report에 이유를 적는다

# Frontend Requirements

`frontend/app/programs/page.tsx`는 기존 단순 목록에서 허브형 목록으로 확장한다.

필수 요소:

- 상단 헤더: 타이틀, 현재 결과 수, 정렬 UI
- 검색 입력
- 카테고리 필터
- 지역 다중 선택 필터
- 모집중만 보기 토글
- 활성 필터 표시와 개별 해제
- 20건 단위 페이지네이션
- 빈 상태와 에러 상태

UI 상태는 URL query와 동기화되어야 한다.

최소 query keys:

- `q`
- `category`
- `regions`
- `recruiting`
- `sort`
- `page`

카드 규칙:

- 기존 상세 링크 `href="/programs/{id}"` 유지
- 기존 데이터가 없는 경우 fallback 문구 유지 또는 보강
- `deadline` 또는 `end_date` 중 실제 신뢰 가능한 값으로 날짜 표시
- `application_url`, `link`, `source_url` 우선순위는 기존 상세 페이지 규칙과 충돌하지 않게 맞춘다

디자인 방향:

- 기존 `/programs`보다 정보 구조를 강화하되 저장소의 현재 스타일 언어를 크게 벗어나지 않는다
- 참고 draft는 `cowork/drafts/isoser-programs.html`이지만, draft를 그대로 복제하지 말고 현재 Next/Tailwind 구조에 맞게 압축 적용한다
- 폰트는 기존 Pretendard 유지

# Category Alignment Rule

현재 프론트의 `PROGRAM_CATEGORIES`와 backend/program data의 category 체계가 다르므로, 이번 Task에서 한 번 정리해야 한다.

원칙:

- UI 필터 카테고리는 실제 데이터와 매칭되는 체계만 노출한다
- 하드코딩된 분류가 실제 조회 결과를 빈 화면으로 만드는 상태는 허용하지 않는다
- 기존 constants를 유지하든 축소하든, 기준은 "현재 `programs` 데이터와 backend 필터가 일관되게 동작하는가"다

구현자는 아래 중 안전한 쪽을 선택한다.

1. 현재 backend category 체계에 맞춰 프론트 categories를 축소/정렬
2. 프론트 category label과 backend filter value를 명시적으로 매핑

선택한 방식은 result report와 refactoring log에 남긴다.

# Acceptance Criteria

1. `/programs`는 비로그인 상태로 계속 접근 가능하다
2. `frontend/middleware.ts`의 보호 범위(`/onboarding`, `/dashboard*`)는 변경되지 않는다
3. `/programs`에서 검색어, 카테고리, 지역, 모집중 토글, 정렬, 페이지 상태가 URL query로 유지된다
4. 새로고침 후에도 같은 query state로 같은 결과가 다시 보인다
5. 페이지 크기는 20건이며, 21건 이상일 때 페이지네이션이 동작한다
6. 카드 클릭 시 기존 `/programs/[id]` 상세 페이지가 계속 열린다
7. 기존 `/programs/[id]`의 핵심 동작은 깨지지 않는다
8. `GET /programs/` 관련 변경이 기존 추천/상세 호출을 깨지 않는다
9. 관리자 sync 엔드포인트 `/admin/sync/programs`는 계속 `hrd_id` 기준 upsert 흐름을 유지한다
10. 기존 `programs` migration 파일은 수정되지 않는다
11. additive migration이 추가된 경우, 왜 필요한지와 기존 데이터에 대한 영향이 result report에 적혀 있다
12. `docs/specs/api-contract.md`가 실제 구현 기준으로 업데이트된다

# Edge Cases

- 결과 0건: "조건에 맞는 프로그램이 없습니다"와 필터 초기화 제공
- 전체 데이터 0건: "현재 등록된 프로그램이 없습니다"
- `deadline`과 `end_date`가 모두 비어 있으면 날짜 배지는 숨기고 텍스트 fallback 사용
- `location` 또는 `category` 값이 불규칙하면 필터 집계에서 안전하게 fallback 처리
- query에 알 수 없는 category/region 값이 들어오면 전체 또는 무시 가능한 기본값으로 복구
- backend 미응답 시 사용자에게 현재 목록 로딩 실패 메시지를 보여준다

# Checks

관련 변경 후 최소 아래를 실행한다.

- frontend 타입체크 또는 lint 중 touched area를 검증할 수 있는 명령
- backend tests 또는 최소 programs router 관련 검증
- 추가한 migration이 있다면 SQL 문법/적용 의도 점검

실행하지 못한 검사는 result report에 명시한다.

# Deliverables

- 구현 코드
- `reports/TASK-2026-04-15-1040-programs-hub-delta-result.md`
- 필요 시 `docs/specs/api-contract.md` 갱신
- 필요 시 `docs/current-state.md` 갱신
- `docs/refactoring-log.md` 업데이트

# Transport Notes

- 이 packet은 drifted packet `TASK-2026-04-15-0951-programs-hub-mvp`를 대체하는 delta packet이다
- 기존 drift report는 참고 기록으로 유지한다
- 실행 대상: `tasks/inbox/TASK-2026-04-15-1040-programs-hub-delta.md`
