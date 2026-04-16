---
id: TASK-2026-04-15-1500-tier2-seoul-crawl
status: queued
type: feature
title: "Tier 2 서울시 광역 크롤링 collector 구현 — parser/collector 마무리 및 scheduler 연결"
planned_at: "2026-04-15T18:45:00+09:00"
planned_against_commit: "33e49ae3d87fe9d20f60c1aee08a5389c67a0ba5"
priority: high
planned_by: Claude (PM)
auto_recovery_attempts: 2
---

## Goal

현재 worktree에 이미 추가된 Tier 2 collector 구현 흔적을 기준으로,
서울시 광역 HTML collector 6종의 parser/collector 코드를 마무리하고 scheduler 연결을 안정화한다.

이 task는 greenfield 구현이 아니다.
이미 존재하는 아래 파일을 기준으로 미완성 부분을 보완하는 continuation task다.

- `backend/rag/collector/base_html_collector.py`
- `backend/rag/collector/regional_html_collectors.py`
- `backend/tests/test_tier2_collectors.py`
- `backend/rag/collector/scheduler.py`

## User Flow

이 기능은 사용자 직접 노출 기능이 아니라 데이터 수집 파이프라인이다.

1. Tier 2 HTML collector가 목록 페이지를 파싱한다.
2. 각 collector가 제목, 링크, 마감일, category hint, target 같은 최소 필드를 추출한다.
3. scheduler가 Tier 1 뒤에 Tier 2 collector를 포함해 계속 실행된다.
4. 개별 collector 실패가 전체 배치를 중단시키지 않는다.

## Scope

대상 collector:

- `SeoulJobPortalCollector`
- `SbaPostingCollector`
- `SesacCollector`
- `Seoul50PlusCollector`
- `CampusTownCollector`
- `SeoulWomanUpCollector`

이번 task의 핵심 범위:

- parser selector 보정
- 공통 HTML collector 유틸 보완
- scheduler import 및 등록 안정화
- 테스트 고정

## Acceptance Criteria

1. `backend/tests/test_tier2_collectors.py`의 6개 collector parser 테스트가 모두 통과한다.
2. `backend/rag/collector/scheduler.py`가 Tier 1 뒤에 Tier 2 collector를 등록하고 import/runtime 오류 없이 로드된다.
3. `base_html_collector.py`와 `regional_html_collectors.py`가 현재 backend 실행 방식에서 import 오류 없이 동작한다.
4. 개별 collector 예외가 scheduler 전체 중단으로 번지지 않는 현재 동작을 유지한다.

## Constraints

- 현재 worktree의 collector 구현을 되돌리거나 새로 다시 쓰지 않는다.
- 이번 task에서는 프로그램 DB schema를 새로 설계하지 않는다.
- 이번 task에서는 “실제 Supabase에 각 collector가 1건 이상 적재”를 필수 acceptance로 두지 않는다.
- 브라우저 자동화는 사용하지 않는다.
- `urllib` + `BeautifulSoup` 기반 구조를 유지한다.

## Non-goals

- category enum/schema 전면 개편
- `source_type=regional_crawl`를 위한 DB migration 추가
- 추천 시스템 연동 검증
- 프론트 프로그램 허브 수정

## Edge Cases

- 사이트 구조 변경으로 특정 selector가 깨질 수 있음
- 일부 소스는 JavaScript 렌더링 흔적이 있어 HTML 파싱만으로 0건일 수 있음
- import fallback이 과하게 넓으면 실제 parser 오류가 가려질 수 있으므로 실행 환경별 import 안정성이 중요함

## Open Questions

없음.

## Implementation Notes

- 현재 packet은 stale blocked 복구가 아니라 실제 현재 worktree continuation을 기준으로 다시 작성되었다.
- schema/운영 검증은 별도 task로 다루고, 이번 task는 parser/scheduler 코드 안정화에 집중한다.
- `1700`과 직접 의존하지는 않지만, 두 task 모두 현재 추천/프로그램 허브 기반 정리에 포함된다.
