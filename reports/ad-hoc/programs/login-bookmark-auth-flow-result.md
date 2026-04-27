# login-bookmark-auth-flow result

## Changed files

- `frontend/app/(auth)/login/page.tsx`
- `frontend/app/(landing)/programs/program-bookmark-button.tsx`
- `frontend/app/(landing)/programs/program-card.tsx`
- `docs/current-state.md`
- `docs/refactoring-log.md`
- `reports\ad-hoc\programs\login-bookmark-auth-flow-result.md`

## Why changes were made

- 로그인 화면의 설명이 "예전 랜딩으로 돌아가지 않는다"는 이동 정책 중심이라, 실제 로그인 이점인 찜 저장, 맞춤 추천, 문서 준비 기능이 더 분명하게 보이도록 바꿨다.
- 비로그인 상태의 프로그램 별 버튼이 disabled라 찜 의도가 가입 흐름으로 이어지지 않았으므로, 현재 보고 있던 프로그램 화면을 `redirectedFrom`으로 보존해 로그인 페이지로 이동하도록 했다.
- `ProgramCard`가 별 버튼 상태, 로그인 redirect, dashboard bookmark mutation을 직접 구현하고 있어 공용 `ProgramBookmarkButton` 기준과 다시 어긋날 수 있었다. 카드에서는 공용 버튼을 배치만 조정해 재사용하도록 정리했다.

## Preserved behaviors

- 로그인 사용자의 찜 저장/삭제는 기존 `/api/dashboard/bookmarks/{programId}` BFF 계약을 그대로 사용한다.
- `redirectedFrom`은 기존 `getLoginHref`/`resolveInternalPath` 흐름을 재사용해 내부 경로만 허용한다.
- pending 상태에서는 기존처럼 버튼을 비활성화해 중복 mutation을 막는다.
- 카드의 제목/본문 링크 영역과 별 버튼의 `preventDefault`/`stopPropagation` 동작은 공용 버튼에서 유지한다.
- 로그인 없이 프로그램 탐색과 비교가 가능하다는 안내는 유지했다.

## Risks / possible regressions

- 비로그인 별 버튼이 더 이상 disabled가 아니므로, 화면별 클릭 추적/테스트가 disabled 상태를 전제로 하면 갱신이 필요하다.
- program id가 없는 카드에서는 별 버튼을 렌더링하지 않는다. 기존에도 실제 찜 mutation은 불가능했던 케이스라 기능 손실 가능성은 낮다.
- `window.location.assign` 기반 이동이라 브라우저 환경에서만 동작한다. 해당 버튼은 client component라 SSR 경로에는 영향이 없다.

## Test points

- 비로그인 상태에서 `/programs?query...` 테이블 별 버튼 클릭 시 `/login?redirectedFrom=...`으로 이동하는지 확인한다.
- 비로그인 상태에서 카드형 프로그램 별 버튼 클릭 시 같은 로그인 이동이 적용되는지 확인한다.
- 비로그인 상태에서 `/programs/[id]` 상세 별 버튼 클릭 시 로그인 후 같은 상세 경로로 돌아오는지 확인한다.
- 로그인 상태에서 목록/상세 별 버튼의 저장/해제가 기존처럼 동작하는지 확인한다.
- 로그인 페이지에 찜 저장, 맞춤 추천, 문서 준비 중심 문구가 표시되는지 확인한다.

## Follow-up refactoring candidates

- 공용 `ProgramBookmarkButton`에 위치/크기 variant prop이 필요해지면 className 조합 대신 작은 variant API로 정리할 수 있다.

