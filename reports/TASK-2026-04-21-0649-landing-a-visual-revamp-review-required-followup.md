# Review-required Follow-up: TASK-2026-04-21-0649-landing-a-visual-revamp

## Summary

`tasks/review-required`로 분기된 원인 중 build 실패와 post-hero D-Day 요약 섹션 모호성을 후속 조치했고, 이후 수동 리뷰 피드백에 따라 랜딩 A의 렌더링 구조를 더 축소했다. 추가 리뷰 피드백으로 랜딩 A 전용 헤더를 복구하고 헤더 링크 목적지를 정리했다.

## Changed files

- `frontend/app/(landing)/landing-a/page.tsx`
- `frontend/app/(landing)/landing-a/_components.tsx`
- `frontend/app/(landing)/landing-a/_content.ts`
- `frontend/app/(landing)/landing-a/_styles.ts`
- `frontend/app/dashboard/page.tsx`
- `reports/TASK-2026-04-21-0649-landing-a-visual-revamp-result.md`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made

- 기존 `LandingATrustSection`은 히어로 직후에 렌더링되지만 이름과 문구가 일반 trust strip에 가까워 packet의 `실시간 D-Day/마감 요약 스트립` 역할이 명확하지 않았다.
- 해당 섹션을 `LandingADeadlineSummarySection`으로 바꾸고 `D-Day 요약`, `모집 상태`, `다음 액션` 라벨을 추가해 섹션 의도를 실제 렌더링에서 확인 가능하게 했다.
- 현재 사용하지 않는 `compareCards` import를 제거해 lint 실패를 해소했다.
- 수동 리뷰에서 상단 티커/네브바와 일부 설명성 중간 섹션 삭제, 히어로 축소, live board 압축, CTA 로그인 후 캘린더 이동을 요구해 렌더링 구조를 다시 정리했다.
- 추가 리뷰에서 헤더 복구와 `프로그램 상세`/`비교`/`대시보드`/로그인 또는 프로필 이동이 요구되어 랜딩 A 전용 헤더를 새로 렌더링했다.

## Preserved behaviors

- `listPrograms`와 `getProgramCount` 호출 경로는 변경하지 않았다.
- 검색/칩 필터, 프로그램 카드, 푸터, 광고 슬롯 배치는 유지했다.
- 랜딩 B, API, 백엔드는 변경하지 않았다. 대시보드는 캘린더 앵커 id만 추가했다.
- 공통 `LandingANavBar` export는 다른 라우트가 사용하므로 변경하지 않고, landing-a 페이지에만 전용 헤더를 적용했다.

## Verification

- `npm --prefix frontend run lint`: passed.
- `./node_modules/.bin/tsc --noEmit` from `frontend/`: passed.
- `npm --prefix frontend run build`: passed. Header follow-up 이후 한 차례 intermittent Next route-module prerender error가 발생했지만, `.next` 정리 후 즉시 재실행에서 통과했다.
- Local browser render check: `/landing-a` was captured at `375x812` and `1440x1000` viewports on `http://localhost:3021`, then rechecked at `375x812` on `http://localhost:3022` after restoring the 6-step flow. The page rendered with the compact navy hero, compact live board, search/filter, program feed, 6-step flow, preview cards, CTA, and footer. Removed ticker/nav/D-Day/problem-solution/recommendation/KPI sections were absent from the rendered flow.
- Header follow-up browser check: `/landing-a` was captured again at `375x812` and `1440x1000` on `http://localhost:3023`; desktop header showed `프로그램 상세`, `비교`, `대시보드`, `로그인`, and mobile header fit `상세`, `비교`, `대시보드`, `로그인` in the first viewport.

## Risks / possible regressions

- Placeholder preview images are still static mock assets and should be replaced with real dashboard captures later.
- Shared `LandingATickerBar` and `LandingANavBar` remain exported because `/programs`, `/compare`, `landing-b`, and dashboard layout still import them. Deleted landing-a-only section components/content were removed from `_components.tsx` and `_content.ts`.

## Follow-up refactoring candidates

- Split the large `_components.tsx` into section-level files inside `frontend/app/(landing)/landing-a/` after this task is accepted.
- Remove unused legacy section/content exports once no external reference depends on them.
