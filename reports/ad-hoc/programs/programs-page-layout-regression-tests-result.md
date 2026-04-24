# Programs Page Layout Regression Tests Result

## changed files

- `frontend/lib/programs-page-layout.ts`
- `frontend/lib/programs-page-layout.test.ts`
- `frontend/app/(landing)/programs/page.tsx`

## why changes were made

- `/programs` 마감임박 섹션이 검색/필터와 독립적으로 유지되어야 하는 정책이 페이지 내부 inline 객체에만 있어 회귀 위험이 컸다.
- 마감임박 압축 카드 chip 중복 제거도 inline 로직이어서 React duplicate key 오류가 다시 발생할 수 있었다.

## preserved behaviors

- 전체 프로그램 목록의 검색/필터/정렬 요청은 기존 query를 그대로 사용한다.
- 마감임박 섹션은 기존과 동일하게 `recruiting_only=true`, `sort=deadline`, `limit=12`, `offset=0` 기준으로 조회한다.
- 마감임박 카드에는 기존처럼 최대 4개의 핵심 chip만 표시한다.

## risks / possible regressions

- helper 분리 자체는 UI 표시를 바꾸지 않는다.
- `buildUrgentProgramChips()`가 페이지의 `getDisplayCategories()`와 유사한 fallback을 별도로 갖고 있어, 향후 대표 카테고리 규칙이 바뀌면 함께 갱신해야 한다.

## verification

- `npm test`: 3 files passed, 9 tests passed.
- `npx tsc --noEmit --project tsconfig.json`: passed.
- `npm run lint`: passed.

## follow-up refactoring candidates

- `/programs` table column widths와 urgent card layout constants를 같은 helper 파일로 옮겨 layout 정책을 더 명시적으로 관리한다.
- `getDisplayCategories()`와 urgent chip category fallback을 공용 helper로 합쳐 중복을 줄인다.
