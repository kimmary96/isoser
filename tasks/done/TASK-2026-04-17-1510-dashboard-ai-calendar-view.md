---
id: TASK-2026-04-17-1510-dashboard-ai-calendar-view
status: queued
type: feature
title: "대시보드 AI 맞춤 캘린더 뷰 — 메인 영역에 마감 임박 일정 카드 + 미니 캘린더"
planned_at: 2026-04-17T15:10:00+09:00
planned_against_commit: fc271882d1406fabd06522dd30bf36ee923d7d9e
priority: P0
planned_by: claude-pm
auto_recovery_attempts: 1
depends_on:
  - TASK-2026-04-17-1500-recommend-hybrid-rerank-calendar
---

# Goal

대시보드 홈(`frontend/app/dashboard/`)의 기존 **AI 맞춤 취업 지원 캘린더** 영역을 현재 API 계약과 UI 구조 기준에 맞게 업데이트한다.

기존 대시보드에는 이미 캘린더 섹션과 추천 카드/미니 캘린더가 일부 존재하지만, 현재 구현은 오래된 추천 프로그램 플로우(`getRecommendedPrograms`)와 결합되어 있고 본 패킷이 요구한 hook/component 분리, 전용 BFF(`/api/dashboard/recommend-calendar`), 카드 CTA/정렬/상태 처리 기준과 다르다.

이 Task는 기존 섹션을 다음 기준으로 정리한다:
1. 대시보드 홈의 기존 "AI 맞춤 취업 지원 캘린더" 섹션을 `/api/dashboard/recommend-calendar` 기반으로 교체
2. 전용 hook과 dashboard 범위 컴포넌트로 분리
3. 가로 스크롤 가능한 추천 일정 카드 리스트와 미니 월별 캘린더를 패킷 요구사항에 맞게 보정
4. 각 카드에 "지원하기"(외부 링크)와 "이력서 바로 만들기"(링크만) CTA 추가

# User Flow

1. 로그인 사용자가 `/dashboard`에 접근한다
2. 페이지 상단 hero 영역 아래의 기존 "이달의 AI 맞춤 일정" 섹션이 전용 캘린더 추천 데이터로 렌더된다
3. 가로 스크롤 카드 리스트에 마감 임박순으로 5~10개 일정이 표시된다
4. 각 카드에는 D-day 라벨, 프로그램명, 출처, 지역, 관련도 점수, 마감일이 표시된다
5. D-7 이하 카드는 빨간색 배지("D-3", "D-1", "D-Day")로 강조된다
6. 카드 우측에 미니 캘린더가 표시되어, 이번 달 마감 일정이 점/뱃지로 보인다 (모바일에서는 카드 아래로 이동)
7. 카드 클릭 시 `/programs/[id]`로 이동한다
8. 카드 내 "지원하기" CTA는 프로그램 외부 링크(`apply_url` 또는 `link`)로 새 탭 이동
9. 카드 내 "이력서 바로 만들기" CTA는 `/dashboard/resume?prefill_program_id=<id>`로 이동 (실제 프리필 로직은 별도 task)
10. 비로그인 사용자가 어떻게든 도달할 경우 기존 인증 가드대로 로그인 유도 (대시보드는 로그인 전제)

# UI Requirements

- 캘린더 섹션 컨테이너는 기존 대시보드 카드 디자인 토큰(둥근 모서리, 흰 배경, sky 계열 강조색)과 일치한다
- 가로 스크롤 카드: 모바일은 1.2개, 태블릿 2.2개, 데스크톱 3~4개가 한 화면에 보이도록 width 설정
- 미니 캘린더는 라이브러리 도입 없이 단순 grid (월 7x6) 로 구현한다 (외부 캘린더 라이브러리 도입 금지)
- D-day 배지 색 단계: D-1~D-3 빨강, D-4~D-7 주황, D-8 이상 회색
- 카드 상단에 source 배지(HRD넷, 고용24 등)
- 빈 상태: "아직 추천할 일정이 없습니다. 프로필을 완성하면 맞춤 일정이 보입니다." + 프로필 편집 CTA
- 에러 상태: 섹션을 숨기고 다른 대시보드 영역(성과저장소 요약 등)은 정상 동작

# Acceptance Criteria

1. `/dashboard`의 기존 "AI 맞춤 취업 지원 캘린더" 섹션이 `GET /api/dashboard/recommend-calendar` 데이터로 동작한다
2. 섹션은 `GET /api/dashboard/recommend-calendar`(BFF)를 통해 데이터를 받는다 — BFF는 FastAPI `GET /recommend/calendar`를 호출한다
3. 카드는 `final_score desc`, 동점일 때 `deadline asc`로 정렬된다
4. D-7 이내 카드에 강조 색 배지가 보인다
5. 카드 클릭 시 `/programs/[id]`로 이동한다
6. "이력서 바로 만들기" CTA가 카드에 존재하며 `/dashboard/resume?prefill_program_id=<id>` 링크를 갖는다 (이 task에서는 실제 프리필 동작 구현 X — 링크만)
7. 추천 데이터가 0건이거나 API 실패 시 섹션 숨김 또는 빈 상태 메시지 표시 (대시보드 다른 영역 영향 없음)
8. 미니 캘린더가 표시되며, 각 마감일에 점/배지가 보인다 (호버 시 프로그램명 tooltip은 선택)
9. 기존 대시보드 홈의 다른 카드(성과저장소 요약, 최근 문서 등)와 레이아웃 충돌이 없다
10. Next API route는 `apiOk` / `apiError` 헬퍼 사용
11. 신규 클라이언트 hook은 `frontend/app/dashboard/_hooks/`에, UI 조각은 `frontend/app/dashboard/_components/` 또는 `dashboard/calendar/_components/` 패턴을 따른다

# Constraints

- 의존 task(TASK-2026-04-17-1500)는 이미 반영되어 있으며 현재 응답 스키마와 BFF가 존재한다
- 외부 캘린더 라이브러리 도입 금지 (`react-big-calendar`, `fullcalendar` 등 사용 안 함)
- 기존 대시보드 홈 페이지 컴포넌트 구조를 전면 재작성하지 않는다. 기존 캘린더 섹션을 국소 수정/분리하는 범위로 제한한다
- 브라우저 직접 Supabase 접근 금지. 항상 Next API route 경유
- API 에러 형식: `{ error, code }` (frontend/lib/api/route-response.ts 헬퍼 사용)
- 데이터 fetch는 클라이언트 hook으로 분리하고, 페이지 컴포넌트는 hook 결과를 받아 렌더만 한다
- 기준 문서(CLAUDE.md, AGENTS.md, docs/) 직접 수정 금지
- 이미 존재하는 `/dashboard` 캘린더 섹션을 재사용하되, 동일 역할의 섹션을 중복 추가하지 않는다

# Non-goals

- 일정 추가/편집/삭제 기능 (캘린더는 추천 결과 read-only 표시)
- 외부 캘린더(Google Calendar 등) 동기화
- "이력서 바로 만들기" CTA의 실제 프리필 동작 (TASK-2026-04-17-1520에서 처리)
- 푸시/이메일 마감 알림
- 캘린더 월/주 전환 토글, 드래그앤드롭, 일정 색상 커스터마이징
- 비로그인 사용자용 캘린더 (대시보드는 로그인 전제 유지)

# Edge Cases

- 한 달에 마감 일정이 하나도 없는 경우: 미니 캘린더는 빈 상태로 표시 + "이번 달 마감 일정 없음" 안내
- D-day 음수(마감 지난) 카드는 응답에서 제외되도록 백엔드가 처리하므로 프론트는 추가 필터링 불필요
- 같은 날짜에 여러 프로그램 마감: 미니 캘린더 셀에 점 1개 + 숫자 배지(예: "+3")
- 모바일(<= 360px) 폭에서 가로 스크롤 카드와 미니 캘린더가 겹치지 않도록 stack 레이아웃
- API 응답 지연(>3s): 카드 영역에 skeleton 표시, 5초 초과 시 빈 상태로 fallback
- 미니 캘린더 키보드 접근성: 최소한 셀이 `button` 또는 link 역할을 갖고 focus ring이 보이도록

# Open Questions

1. 미니 캘린더 위치: 캘린더 카드 우측 고정(데스크톱) vs 카드 위 한 줄(모든 폭). 기존 `/dashboard` 레이아웃과 충돌이 적은 쪽을 선택
2. "이력서 바로 만들기" CTA를 D-7 이하 카드에만 노출할지 모든 카드에 노출할지 — 기본 모든 카드, 디자인 검토 후 조정
3. 기존 홈에 이미 있는 추천 프로그램 그리드와의 관계: 캘린더 섹션은 유지하되 데이터 소스와 역할을 명확히 분리하고, 기존 추천 그리드는 필요 시 별도 섹션으로 유지

# Transport Notes

- 로컬 실행: `tasks/inbox/TASK-2026-04-17-1510-dashboard-ai-calendar-view.md`
- 원격 실행: `tasks/remote/TASK-2026-04-17-1510-dashboard-ai-calendar-view.md`
- 현재 재실행 범위는 "신규 구현"이 아니라 기존 캘린더 섹션을 현행 API/구조에 맞게 정리하는 fix/update 성격의 작업이다
