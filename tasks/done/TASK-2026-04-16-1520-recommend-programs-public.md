---
id: TASK-2026-04-16-1520-recommend-programs-public
status: queued
type: feature
title: "프로그램 추천 공개 연동 — /programs 페이지에 로그인 사용자 맞춤 추천 섹션 추가"
planned_at: 2026-04-16T15:20:00+09:00
planned_against_commit: b0bceaa6787b988ff3469a85b85e3c2224786aa9
auto_recovery_attempts: 1
---

# Goal

공개 프로그램 목록 페이지(`frontend/app/(landing)/programs/page.tsx`)에 로그인 사용자 전용 맞춤 추천 섹션을 추가한다.

현재 백엔드 `POST /programs/recommend`와 프론트 프록시 `GET /api/dashboard/recommended-programs`는 동작하지만, 공개 프로그램 페이지에는 아직 추천 섹션이 없다. 현재 워크트리에서 `frontend/app/(landing)/programs/page.tsx`에는 프로그램 카드의 "비교에 추가" CTA가 추가되는 중이며, 이 Task는 그 변경을 보존한 채 추천 섹션만 독립적으로 얹어야 한다.

이 Task는 공개 프로그램 페이지 상단에 추천 카드 섹션을 추가해, 로그인 사용자가 프로그램을 탐색할 때 바로 개인화 추천을 볼 수 있게 한다. 비로그인 사용자에게는 추천 섹션을 숨기고 로그인 유도 배너를 대신 표시한다.

# User Flow

1. 로그인 사용자가 `/programs` 페이지에 접근한다
2. 페이지 상단(필터 위 또는 카드 그리드 위)에 "내 맞춤 추천 프로그램" 섹션이 표시된다
3. 추천 카드(최대 3~4개)에 추천 이유(`_reason`)와 관련도 점수가 함께 표시된다
4. 추천 카드 클릭 시 `/programs/[id]` 상세 페이지로 이동한다
5. "전체 추천 보기" 링크 클릭 시 대시보드 홈(`/dashboard`)으로 이동한다
6. 비로그인 사용자는 추천 섹션 대신 "로그인하면 맞춤 프로그램을 추천해드립니다" 배너가 표시된다

# 작업 상세

## 프론트엔드

1. `frontend/app/(landing)/programs/page.tsx` (또는 관련 클라이언트 컴포넌트)에 추천 섹션 추가
   - 기존 `getRecommendedPrograms` (`frontend/lib/api/app.ts`)를 재사용한다
   - 로그인 여부는 Supabase 세션으로 판별한다
   - 로그인 사용자: 추천 API 호출 → 결과 카드 렌더링
   - 비로그인 사용자: 로그인 유도 배너만 표시
   - 추천 API 실패 시: 섹션 자체를 숨김 (에러 없이 graceful degradation)
   - 현재 워크트리의 기존 카드 액션(`상세 보기`, `비교에 추가`, 외부 지원 링크`)과 필터/검색/페이지네이션 동작은 유지한다

2. 추천 카드 UI
   - 기존 프로그램 카드와 유사하되, 추천 이유(`_reason`)를 카드 하단에 한 줄로 표시
   - 관련도 점수(`_score`)를 프로그레스 바 또는 퍼센트로 표시 (선택)
   - 카드 개수: 최대 4개, 가로 스크롤 또는 그리드

## 백엔드

- 변경 없음. 기존 `POST /programs/recommend` 그대로 사용

## 데이터

- 변경 없음. 기존 프록시 route `GET /api/dashboard/recommended-programs` 재사용
- 단, route 경로가 `/api/dashboard/` 아래에 있어서 공개 페이지에서 호출 시 인증 문제가 없는지 확인 필요. 현재 route 코드는 세션이 없으면 accessToken 없이 호출하므로 비로그인에서도 에러는 나지 않음 (빈 추천 반환)
- `frontend/lib/api/app.ts`에는 현재 다른 작업의 `getDashboardBookmarks` helper가 추가되어 있으므로, 추천 연동은 기존 `getRecommendedPrograms` 재사용 범위로 제한한다

# Acceptance Criteria

1. 로그인 사용자가 `/programs`에 접근하면 상단에 "맞춤 추천" 섹션이 표시된다
2. 추천 섹션에 최대 4개의 프로그램 카드가 표시된다
3. 각 카드에 추천 이유가 한 줄로 표시된다
4. 추천 카드 클릭 시 `/programs/[id]`로 이동한다
5. 비로그인 사용자에게는 추천 섹션 대신 로그인 유도 배너가 표시된다
6. 추천 API 호출 실패 시 섹션이 숨겨지고 나머지 프로그램 목록은 정상 동작한다
7. 기존 `/programs` 페이지의 필터, 검색, 페이지네이션 동작에 영향 없다
8. 기존 대시보드 홈의 추천 기능에 영향 없다

# Constraints

- 백엔드 수정 없음. 프론트엔드 변경만으로 처리
- 기존 `/programs` 페이지의 필터/검색/정렬 로직을 건드리지 않는다
- 추천 섹션은 기존 카드 그리드 위에 독립 섹션으로 추가한다
- `getRecommendedPrograms` API 클라이언트를 재사용한다
- 현재 워크트리의 프로그램 카드 compare CTA 및 `frontend/lib/api/app.ts`의 북마크 helper 변경은 이 Task 범위 밖으로 간주하고 보존한다

# Non-goals

- 추천 알고리즘 개선
- `recommendations` 테이블 변경
- 비로그인 사용자 대상 추천 (퀴즈 기반 등)
- 추천 결과 → 이력서 프리필 연결 (별도 Task)
- 북마크 연동 (이미 프로그램 카드에 구현되어 있다면 자연스럽게 동작)

# Edge Cases

- 추천 결과가 0건인 경우: "아직 추천할 프로그램이 없습니다. 프로필을 완성하면 맞춤 추천이 가능합니다" 안내 + 프로필 편집 링크
- 추천 API 타임아웃: 섹션 숨김, 에러 로그만 기록
- 추천 카드 중 일부가 이미 필터 결과에 포함된 경우: 중복 표시 허용 (추천 섹션과 목록은 독립적)

# Open Questions

1. 추천 섹션 위치: 필터 바 위 vs 카드 그리드 바로 위. 구현 러너가 시안과 페이지 흐름 보고 판단
2. 추천 카드에 관련도 점수 프로그레스 바를 넣을지 텍스트만 할지. 간결함을 위해 텍스트 추천

# Transport Notes

- 로컬 실행: `tasks/inbox/TASK-2026-04-16-1520-recommend-programs-public.md`
- 원격 실행: `tasks/remote/TASK-2026-04-16-1520-recommend-programs-public.md`
