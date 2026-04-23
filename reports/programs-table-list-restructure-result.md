# Programs Table List Restructure Result

## Changed files

- `frontend/app/(landing)/programs/page.tsx`
- `frontend/app/(landing)/programs/program-card.tsx`
- `frontend/app/(landing)/programs/program-bookmark-button.tsx`
- `frontend/app/(landing)/programs/program-utils.ts`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made

- 전체 프로그램 목록의 목적을 카드 탐색보다 다건 비교에 맞추기 위해 카드 그리드를 엑셀형 테이블로 전환했다.
- `내 맞춤 추천` 섹션은 목록 화면의 초점을 분산시켜 제거했다.
- `마감 임박`은 보조 탐색 영역으로 유지하되 한 줄 가로 스크롤 카드 레일로 축소했다.

## Preserved behaviors

- 기존 검색, 필터, 정렬, 모집중/최근 마감 포함, 페이지네이션 URL query 흐름을 유지했다.
- 마감 임박 데이터는 기존처럼 별도 `deadline` 정렬 fetch에서 파생하며 전체 목록 현재 페이지에 의존하지 않는다.
- 제목/마감일/source가 있는 프로그램만 노출하는 표시 정책을 유지했다.
- 로그인 사용자의 기존 찜 상태 prefetch와 화면 내 공유 bookmark state를 유지했다.
- 프로그램 상세 이동 경로 `/programs/{id}`를 유지했다.

## Risks / possible regressions

- 테이블은 모바일에서 폭이 넓어지므로 현재는 가로 스크롤로 대응한다. 모바일 전용 압축 행 UI는 후속 개선 후보로 남긴다.
- 선발절차·키워드 컬럼은 현재 구조화 필드가 제한적이어서 `compare_meta`, `tags`, `skills` 기반의 보수적 표시다.
- 맞춤 추천 섹션 파일과 BFF는 다른 화면 또는 후속 재사용 가능성을 고려해 제거하지 않고 렌더링만 중단했다.

## Follow-up refactoring candidates

- `ProgramCard`의 찜 버튼도 `ProgramBookmarkButton`을 사용하도록 통합해 중복 mutation 로직을 줄인다.
- 테이블 컬럼 정의를 배열 설정으로 분리해 컬럼 추가/삭제와 모바일 표시 정책을 쉽게 조정한다.
- 모바일 전용 압축 행 카드 또는 sticky first column 처리를 검토한다.
- 선발 절차와 채용 연계를 운영 DB 구조화 컬럼으로 저장하면 fallback 텍스트 매칭 의존을 줄일 수 있다.

## Verification results

- Passed: `npm run lint -- --file "app/(landing)/programs/page.tsx" --file "app/(landing)/programs/program-card.tsx" --file "app/(landing)/programs/program-bookmark-button.tsx" --file "app/(landing)/programs/program-utils.ts"`
- Passed: `npx tsc -p tsconfig.codex-check.json --noEmit`
- Passed: `git diff --check` on touched files
- Passed: `agent-browser open http://localhost:3001/programs`; no Next.js error overlay detected and key table content rendered
