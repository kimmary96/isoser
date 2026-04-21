# Result: TASK-2026-04-21-0649-landing-a-visual-revamp

## Summary

랜딩 A를 이력 기반 프로그램 추천과 지원 준비 플랫폼 프레이밍으로 재배치했다. 수동 리뷰 피드백을 반영해 상단 티커와 설명성 중간 섹션을 제거하고, 랜딩 A 전용 헤더와 온보딩 페이지 톤의 네이비 히어로, 컴팩트 live board 중심 구조로 축소했다. 기존 공개 랜딩의 데이터 fetching, 검색/칩 필터, 프로그램 카드, 푸터와 광고 슬롯은 유지했다.

## Changed files

- `frontend/app/(landing)/landing-a/page.tsx`
- `frontend/app/(landing)/landing-a/_components.tsx`
- `frontend/app/(landing)/landing-a/_content.ts`
- `frontend/app/(landing)/landing-a/_styles.ts`
- `frontend/app/dashboard/page.tsx`
- `frontend/public/landing-a/program-recommendation-calendar.svg`
- `frontend/public/landing-a/star-coach.svg`
- `frontend/public/landing-a/resume-portfolio-pdf.svg`
- `frontend/public/landing-a/job-matching-score.svg`
- `docs/current-state.md`
- `docs/refactoring-log.md`
- `reports/TASK-2026-04-21-0649-landing-a-visual-revamp-result.md`

## Why changes were made

- 히어로 카피와 CTA를 "국비·지역 프로그램을 내 이력 기반으로 추천받고 바로 지원"하는 가치로 교체했다.
- 수동 리뷰 피드백에 따라 상단 티커/네브바, D-Day 요약, 차별점 비교, 추천 정확도 설명, KPI 뼈대 섹션을 렌더링에서 제거하고 6단계 지원 준비 흐름은 유지했다.
- 히어로 헤드라인 크기를 축소하고 보조 CTA를 제거했으며, live board는 2개 프로그램 카드와 짧은 next step 안내만 남기도록 압축했다.
- 히어로 주 CTA는 비로그인 시 `/login`, 로그인 확인 후 `/dashboard#recommend-calendar`로 이동하도록 변경했다.
- 랜딩 A 전용 헤더를 복구해 `프로그램 상세`(`/programs`), `비교`(`/compare`), `대시보드`(`/dashboard#recommend-calendar`), 로그인/프로필 버튼을 제공하고, 로그인된 사용자 프로필 버튼은 `/dashboard/profile`로 바로 이동하도록 변경했다.
- 기능 맛보기 4개 카드는 지정 순서대로 노출하고, 실제 캡처 교체가 쉽도록 `/landing-a/*.svg` 정적 경로를 사용했다.
- 삭제 대상 메타 해설 문구와 교체 대상 문구를 landing-a 렌더링 범위에서 제거하거나 새 문구로 바꿨다.

## Preserved behaviors

- `page.tsx`의 `listPrograms(programParams)`와 `getProgramCount(...)` 호출 구조는 유지했다.
- chip/keyword 정규화와 검색 form submit 방식은 변경하지 않았다.
- 기존 프로그램 카드 링크, 비교 링크, empty/error fallback, 푸터와 `AdSlot` 배치는 유지했다.
- 랜딩 B, API, 백엔드는 수정하지 않았다. 대시보드는 CTA와 헤더의 앵커 이동을 위해 캘린더 위치에 `recommend-calendar` id만 추가했다.

## Verification

- `npm --prefix frontend run lint`: passed.
- `./node_modules/.bin/tsc --noEmit` from `frontend/`: passed.
- `npm --prefix frontend run build`: passed on rerun after review-required follow-up and after the header follow-up. One intermittent Next route-module prerender error occurred after dev-server cleanup, then passed on immediate cache-clean rerun.
- Mobile 375px render check: captured `/landing-a` at `375x812` viewport on local Next dev server `http://localhost:3022`; full-page screenshot width was `375px`, and the compact hero, live board, search/filter, program feed, 6-step flow, preview cards, CTA, and footer rendered in a single-column mobile stack.
- Desktop render check: captured `/landing-a` at `1440x1000` viewport on local Next dev server `http://localhost:3021`; hero and live board rendered as a compact two-column first viewport without the removed ticker/nav/D-Day/problem-solution/KPI sections.
- Narrow text search confirmed the requested removal strings no longer exist under `frontend/app/(landing)/landing-a`.

## Risks / possible regressions

- The visual revamp changes multiple landing sections at once, so product review should still check copy tone and placeholder preview image quality.
- Placeholder SVGs are intentionally static mock previews; product review should replace them with real captures when available.

## Follow-up refactoring candidates

- If landing A keeps growing, split `_components.tsx` into section-level files inside the same route folder to reduce the large component file size without changing public behavior.

## Review-required follow-up

- Renamed the post-hero summary strip from `LandingATrustSection` to `LandingADeadlineSummarySection`.
- Replaced generic trust copy with explicit `D-Day 요약`, `모집 상태`, and `다음 액션` labels so the section clearly satisfies the packet's D-Day/deadline summary role before the search/filter bar.
- Removed the stale `compareCards` import from `_components.tsx`.

## Manual review follow-up

- Removed the rendered top ticker/navbar.
- Removed the rendered D-Day summary, problem/solution comparison, recommendation-accuracy, and KPI skeleton sections while keeping the 6-step support flow.
- Reworked the hero to match the onboarding page's navy panel tone and reduced the headline scale.
- Removed the hero secondary CTA and changed the primary CTA to route logged-in users to `/dashboard#recommend-calendar`.
- Added `id="recommend-calendar"` around the dashboard calendar area.
- Removed the deleted landing-a section components/content from `_components.tsx` and `_content.ts`; shared ticker/navbar exports remain because other public routes and dashboard layout still import them.

## Header follow-up

- Restored a landing-a-specific header with `프로그램 상세`, `비교`, `대시보드`, and auth action links.
- Routed the dashboard header link to `/dashboard#recommend-calendar`.
- Routed the logged-in profile action to `/dashboard/profile`; unauthenticated users keep the `/login` action.
- Adjusted mobile header labels so `상세`, `비교`, `대시보드`, and `로그인` fit in the first viewport.
