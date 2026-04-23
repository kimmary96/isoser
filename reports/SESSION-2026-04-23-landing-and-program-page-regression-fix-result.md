# SESSION-2026-04-23 Landing and Program Page Regression Fix Result

## Changed files
- `frontend/lib/program-filters.ts`
- `frontend/lib/program-filters.test.ts`
- `frontend/app/(landing)/landing-c/_content.ts`
- `frontend/app/(landing)/landing-c/_hero.tsx`
- `frontend/app/(landing)/landing-c/_program-utils.ts`
- `frontend/app/(landing)/landing-c/_program-utils.test.ts`
- `frontend/app/(landing)/landing-c/page.tsx`
- `frontend/app/(landing)/programs/page.tsx`
- `frontend/app/(landing)/programs/page-helpers.ts`
- `frontend/app/(landing)/programs/page-helpers.test.ts`

## Why changes were made
- 랜딩 `Live Board`가 0건으로 비는 회귀를 줄이기 위해, 소스 1개씩 강제 노출 대신 이번 주 내 마감하는 모집중 공고 중 만족도/리뷰/추천 점수가 높은 상위 3건을 고르도록 조정했다.
- 랜딩 `Opportunity feed`가 작년 프로그램을 포함하던 문제를 줄이기 위해, landing filter helper를 모집중 기준으로 좁히고 `전체`는 만족도 우선, 나머지 칩은 마감 임박 우선으로 정렬했다.
- 프로그램 페이지의 `Closing Soon` 섹션이 현재 필터와 결합되어 사실상 사라진 회귀를 복원하기 위해, 기존 의도대로 전역 urgent query helper를 다시 사용하고 fallback 경로를 보강했다.
- 프로그램 페이지의 스폰서 노출을 별도 섹션에서 메인 리스트 병합 방식으로 바꾸고, 기본 전체 화면에서만 상단 고정되도록 조정했다.
- Work24 계열 `participation_time_text`에 총 시간이 있으면 리스트에서 `48시간`처럼 짧게 보이도록 축약했다.
- 선발절차 키워드 태그에 키워드 계열별 색상을 부여해 가독성을 높였다.

## Preserved behaviors
- 백엔드 프로그램 read-model, promoted API shape, deadline 계산 로직은 변경하지 않았다.
- 프로그램 페이지의 북마크, 페이지네이션, 필터 파라미터, AdSlot 위치는 유지했다.
- 랜딩/프로그램 페이지 모두 기존 server component fetch 구조는 유지하고, 전면적인 레이아웃 재작성 없이 정렬/표시 유틸만 교체했다.

## Risks / possible regressions
- `Live Board`의 "핫한 공고"는 현재 저장소에 프로그램별 클릭수 집계가 없어 실제 클릭수 대신 만족도/리뷰/추천 점수 proxy를 사용한다.
- 프로그램 페이지의 스폰서 병합은 메인 리스트 개수를 첫 페이지에서 최대 3건 늘릴 수 있다. 현재 total count 표시는 organic count 기준을 유지한다.
- landing filter helper가 모집중 기준으로 강화되어, 이전보다 일부 마감/보관 공고 노출이 줄어든다.

## Follow-up refactoring candidates
- 프로그램별 클릭수 또는 상세 진입수 집계를 read-model에 넣으면 `Live Board`를 실제 인기 기준으로 전환할 수 있다.
- 프로그램 페이지의 스폰서 병합/표시 count를 서버 응답 레벨에서 지원하면 pagination count와 리스트 row 수를 더 자연스럽게 맞출 수 있다.
- `page.tsx` 내부의 display/count/fallback 계산을 별도 list-view helper로 더 분리하면 회귀 테스트를 늘리기 쉬워진다.

## Verification
- `frontend`: `npm test -- lib/program-filters.test.ts lib/programs-page-layout.test.ts "app/(landing)/landing-c/_program-utils.test.ts" "app/(landing)/programs/page-helpers.test.ts"`
- `frontend`: `npx tsc --noEmit`
- local dev server: `http://127.0.0.1:3040`
- smoke checks:
  - `/landing-c` HTTP 200
  - `/programs` HTTP 200
  - `/programs` rendered `Closing Soon` / `마감 임박 프로그램`
