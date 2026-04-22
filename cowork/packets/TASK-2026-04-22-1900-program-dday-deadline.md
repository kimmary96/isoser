---
id: TASK-2026-04-22-1900-program-dday-deadline
status: queued
type: feature
title: 프로그램 카드 D-day 모집 마감일 기준 통일
priority: medium
planned_by: claude
planned_at: 2026-04-22T17:28:20+09:00
planned_against_commit: 55b84d578275994465ae0433e58f3a26d51b699e
planned_files: backend/routers/programs.py, backend/rag/programs_rag.py, backend/tests/test_programs_router.py, frontend/app/(landing)/programs/page.tsx, frontend/app/(landing)/programs/[id]/program-detail-client.tsx, frontend/app/(landing)/landing-c/page.tsx, frontend/app/dashboard/page.tsx, frontend/components/MiniCalendar.tsx, docs/current-state.md, docs/refactoring-log.md, reports/TASK-2026-04-22-1900-program-dday-deadline-result.md
planned_worktree_fingerprint: 6c08ce782f2808cb8b362d541172faac6c3fbf98b7186e298c3231f3017769dd
---
# Goal

프로그램 카드와 캘린더에서 표시되는 D-day 기준을 모집 마감일(`deadline`/신청 마감일)로 통일한다.
`end_date`는 교육/운영 종료일로만 사용하고, 모집 마감일이 없을 때 D-day 계산 대체값으로 쓰지 않는다.

# Constraints

- Prefer minimal safe changes.
- Reuse existing patterns before introducing new ones.
- 기존 dirty worktree 변경을 되돌리지 않는다.
- 이번 작업은 D-day 기준일 교정에 한정한다.

# Acceptance Criteria

1. 백엔드 `days_left`와 `d_day_label`은 모집 마감일 기준으로만 계산된다.
2. 프론트 프로그램 목록, 상세 Hero, 대시보드 카드/캘린더, landing-c live board 정렬에서 `end_date`를 D-day 대체값으로 쓰지 않는다.
3. 모집 마감일이 없고 운영 종료일만 있는 프로그램은 D-day를 표시하지 않거나 "정보 없음" 계열 fallback을 사용한다.
4. 기존 훈련/운영 기간 표시는 계속 `start_date`/`end_date`를 사용한다.
5. 관련 단위 테스트와 타입/정적 검증을 실행하고 결과를 report에 남긴다.

# Edge Cases

- `deadline`이 비어 있고 `end_date`만 있는 고용24/기타 프로그램
- `deadline`이 과거인 프로그램
- `deadline`이 날짜 형식이 아닌 프로그램
- 이미 localStorage에 저장된 캘린더 프로그램이 `deadline` 없이 `end_date`만 가진 경우

# Open Questions

- None.
