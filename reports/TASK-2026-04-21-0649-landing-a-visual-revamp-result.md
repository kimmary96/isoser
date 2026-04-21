# Result: TASK-2026-04-21-0649-landing-a-visual-revamp

## Summary

랜딩 A를 이력 기반 프로그램 추천과 지원 준비 플랫폼 프레이밍으로 재배치했다. 기존 공개 랜딩의 데이터 fetching, 검색/칩 필터, 프로그램 카드, 네브바 로그인 상태 확인, 푸터와 광고 슬롯은 유지했다.

## Changed files

- `frontend/app/(landing)/landing-a/page.tsx`
- `frontend/app/(landing)/landing-a/_components.tsx`
- `frontend/app/(landing)/landing-a/_content.ts`
- `frontend/public/landing-a/program-recommendation-calendar.svg`
- `frontend/public/landing-a/star-coach.svg`
- `frontend/public/landing-a/resume-portfolio-pdf.svg`
- `frontend/public/landing-a/job-matching-score.svg`
- `docs/current-state.md`
- `docs/refactoring-log.md`
- `reports/TASK-2026-04-21-0649-landing-a-visual-revamp-result.md`

## Why changes were made

- 히어로 카피와 CTA를 "국비·지역 프로그램을 내 이력 기반으로 추천받고 바로 지원"하는 가치로 교체했다.
- 기존 텍스트 중심 설명 섹션을 문제/해결 비교, 6단계 순환 플로우, 기능 맛보기 이미지 카드, 추천 정확도 설명, KPI 뼈대 섹션으로 전환했다.
- 기능 맛보기 4개 카드는 지정 순서대로 노출하고, 실제 캡처 교체가 쉽도록 `/landing-a/*.svg` 정적 경로를 사용했다.
- 삭제 대상 메타 해설 문구와 교체 대상 문구를 landing-a 렌더링 범위에서 제거하거나 새 문구로 바꿨다.

## Preserved behaviors

- `page.tsx`의 `listPrograms(programParams)`와 `getProgramCount(...)` 호출 구조는 유지했다.
- chip/keyword 정규화와 검색 form submit 방식은 변경하지 않았다.
- 기존 프로그램 카드 링크, 비교 링크, empty/error fallback, 네브바 로그인 상태 확인, 푸터와 `AdSlot` 배치는 유지했다.
- 랜딩 B, 대시보드, API, 백엔드는 수정하지 않았다.

## Verification

- `npm --prefix frontend run lint`: passed.
- `./node_modules/.bin/tsc --noEmit` from `frontend/`: passed.
- `npm --prefix frontend run build`: compiled successfully, then failed during Next type/check phase with `[Error: spawn EPERM]`. Re-running produced the same `spawn EPERM`, so this appears to be an environment/process permission failure after compilation rather than a surfaced TypeScript or ESLint error.
- Narrow text search confirmed the requested removal strings no longer exist under `frontend/app/(landing)/landing-a`.

## Risks / possible regressions

- The visual revamp changes multiple landing sections at once, so final browser verification should still check actual section order, mobile stacking, and horizontal overflow.
- Placeholder SVGs are intentionally static mock previews; product review should replace them with real captures when available.
- `next build` needs to be rerun in an environment where Next can spawn its validation worker.

## Follow-up refactoring candidates

- Remove or repurpose the now-unused exported `LandingAJourneySection` and legacy `compareCards` content after final verification confirms no external reference relies on them.
- If landing A keeps growing, split `_components.tsx` into section-level files inside the same route folder to reduce the large component file size without changing public behavior.
