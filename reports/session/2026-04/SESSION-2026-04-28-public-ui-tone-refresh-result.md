# Public UI Tone Refresh Result

## Changed files

- `frontend/components/ui/isoser-ui.ts`
- `frontend/components/landing/LandingHeader.tsx`
- `frontend/app/(landing)/landing-c/page.tsx`
- `frontend/app/(landing)/landing-c/_styles.ts`
- `frontend/app/(landing)/landing-c/_hero.tsx`
- `frontend/app/(landing)/landing-c/_program-feed.tsx`
- `frontend/app/(landing)/programs/page.tsx`
- `frontend/app/(landing)/programs/programs-filter-bar.tsx`
- `frontend/app/(landing)/programs/programs-table.tsx`
- `frontend/app/(landing)/programs/programs-urgent-card.tsx`
- `frontend/app/(landing)/programs/page-helpers.ts`
- `frontend/app/(landing)/programs/page-helpers.test.ts`
- `frontend/app/(landing)/programs/[id]/page.tsx`
- `frontend/app/(landing)/programs/[id]/program-detail-client.tsx`
- `frontend/app/(landing)/programs/[id]/not-found.tsx`
- `frontend/app/(landing)/compare/programs-compare-client.tsx`
- `frontend/app/(landing)/compare/program-select-modal.tsx`
- `frontend/app/(landing)/compare/compare-table-sections.tsx`
- `frontend/app/(landing)/compare/compare-relevance-section.tsx`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made

- 공개 랜딩, 프로그램 탐색, 프로그램 상세, 비교 페이지의 UI 톤이 서로 달라 프로필 페이지의 회색 배경, 작은 neutral/warm gradient, 프로필 완성도 CTA 계열의 blue gradient button, 오렌지 accent 기준으로 맞췄다.
- 후속 조정으로 랜딩 hero 제목과 상세 페이지 hero gradient에서는 오렌지를 제거하고, 랜딩 최하단 CTA band는 더 어두운 navy 배경으로 바꿨다.
- 이후 대시보드, 프로필, 이력서 화면까지 같은 시각 언어를 확장할 수 있도록 `frontend/components/ui/isoser-ui.ts`에 공통 class helper를 추가했다.

## Preserved behaviors

- 백엔드, DB, API route, Supabase 조회/저장 계약은 변경하지 않았다.
- 프로그램 목록 검색, 필터, 정렬, 페이지네이션, 북마크 동작은 유지했다.
- 비교 슬롯 추가/삭제, 추천 카드 추가, 선택 모달 검색/찜 탭 동작은 유지했다.
- 프로그램 상세 조회, 북마크, 공유, 신청 링크, 상세 진입 집계 호출은 유지했다.

## Risks / possible regressions

- 색상 class 변경이 넓게 들어가므로 특정 데이터 길이에서 카드/테이블 대비나 가독성이 낮아질 수 있다.
- 공통 helper class를 앞으로 더 많이 쓰게 되면 Tailwind content scan 범위 밖에 두지 않도록 `components/ui` 위치를 유지해야 한다.
- 마감/위험 상태 색상은 의미 구분 때문에 일부 rose/orange 계열이 남아 있어, 완전 단색 톤을 기대하면 추가 정리가 필요하다.

## Verification

- `npx tsc --noEmit` from `frontend`: passed.
- `npx vitest run "app/(landing)/programs/page-helpers.test.ts" "app/(landing)/compare/compare-relevance-section.test.ts"` from `frontend`: 2 files, 8 tests passed.
- `npm run lint -- --file ...` for touched frontend files from `frontend`: passed, with Next.js deprecation notice for `next lint`.
- `git diff --check` for touched files: passed, with existing LF-to-CRLF warnings only.
- Browser verification with `agent-browser` on local Next server `http://127.0.0.1:3001`:
  - `/landing-c`: content rendered, no Next error overlay.
  - `/programs`: content rendered, filter controls/table rendered, no Next error overlay.
  - `/compare`: content rendered, compare slots and suggestion cards rendered, no Next error overlay.
  - `/programs/3a415d28-2471-4dce-9993-e36e8b29c6de`: detail content rendered, CTA/bookmark/share controls rendered, no Next error overlay.
- After the option 1 tone adjustment, docs were updated to describe the neutral gray/warm accent direction instead of the earlier blue-heavy direction.

## Follow-up refactoring candidates

- Promote repeated detail page primitives such as `SectionCard`, `FactGrid`, and `ChipList` into shared UI components after the public UI tone settles.
- Gradually migrate dashboard/profile/resume cards and CTA buttons to the new `iso` helper to reduce one-off Tailwind class drift.
- Consider replacing remaining non-state orange/violet accents in older helper constants after confirming they are not used as semantic category colors.
