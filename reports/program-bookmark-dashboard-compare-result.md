# Program Bookmark Dashboard Compare Result

## 변경 파일

- `frontend/app/dashboard/page.tsx`
- `frontend/app/(landing)/compare/program-select-modal.tsx`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## 변경 이유

- 프로그램 목록/상세에서 북마크한 훈련이 비교 페이지 모달과 대시보드에서 같은 저장 상태로 보이도록 하기 위해 기존 dashboard bookmark BFF를 재사용했다.
- 비교 모달은 한 번 찜 목록을 불러온 뒤 같은 세션에서 다시 열 때 최신 변경을 놓칠 수 있어, 모달을 닫았다 다시 열면 재조회하도록 조정했다.
- 대시보드에는 찜한 훈련을 볼 수 있는 영역이 없어 `program_bookmarks` 조회 결과를 별도 섹션으로 표시했다.

## 영향 범위

- 대시보드 상단에 `찜한 훈련` 섹션이 추가된다.
- 비교 프로그램 선택 모달의 찜한 프로그램 탭은 열릴 때마다 `/api/dashboard/bookmarks`를 다시 호출한다.
- 북마크 저장/삭제 API 계약과 DB 테이블은 변경하지 않았다.

## 보존한 동작

- 기존 프로그램 목록/상세 북마크 버튼은 계속 `/api/dashboard/bookmarks/{programId}`로 저장/삭제한다.
- 비교 모달의 전체 검색 탭과 프로그램 추가 흐름은 유지했다.
- 대시보드 추천 캘린더, 캘린더 적용/저장 흐름은 유지했다.

## 리스크

- 대시보드 진입 시 북마크 조회 요청이 1회 추가된다.
- 로그인 세션이 만료된 경우 대시보드의 찜한 훈련 섹션은 불러오기 실패 상태를 표시한다.
- 현재 대시보드 섹션은 최대 6개까지만 표시한다. 전체 목록 관리는 비교 모달이나 프로그램 목록에서 이어가는 구조다.

## 테스트 포인트

- 프로그램 목록 또는 상세에서 별 버튼을 눌러 저장한 뒤 `/compare` 모달의 `찜한 프로그램` 탭에 표시되는지 확인한다.
- 같은 모달을 닫았다 다시 열 때 새로 북마크한 항목이 반영되는지 확인한다.
- `/dashboard`의 `찜한 훈련` 섹션에 북마크한 프로그램이 표시되고 상세/원문 링크가 동작하는지 확인한다.

## 검증 결과

- `npm run lint -- --file "app/dashboard/page.tsx" --file "app/(landing)/compare/program-select-modal.tsx"`: 통과.
- `npx tsc -p tsconfig.codex-check.json --noEmit`: 통과.

## 추가 리팩토링 후보

- 북마크 상태를 대시보드에서도 삭제/해제할 수 있게 하려면 공용 bookmark card/action 컴포넌트로 분리할 수 있다.
- `/programs`, `/compare`, `/dashboard`가 모두 쓰는 bookmark fetch/mutation 타입을 별도 shared type으로 분리할 수 있다.
