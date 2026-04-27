# Dashboard Main Tone Refresh Result

## Changed files

- `frontend/app/dashboard/page.tsx`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made

- 공개 랜딩/프로그램 화면의 회색 배경, white translucent panel, blue primary CTA, soft orange accent 톤과 `/dashboard` 메인 캘린더 화면의 강한 blue gradient 톤이 달라 보였다.
- 사용자가 dashboard layout sidebar는 유지하길 원했으므로, sidebar를 제외한 대시보드 메인 화면 표면과 색상만 맞췄다.
- 후속 조정으로 큰 달력 이벤트 prefix의 원색감을 낮추고, 하단 `내 커리어 핏 추천` 섹션이 너무 밋밋해 보이지 않도록 pale sky background band를 추가했다.
- 추가 조정으로 추천 카드의 gradient를 단색 soft surface로 바꾸고, 큰 달력의 이전/다음달 셀과 grid gap 회색을 더 연하게 낮췄다.
- 추천 카드 배경 순환 색은 기능적 의미가 없어 모두 `#fff1e6` soft orange 단색으로 통일했다.

## Preserved behaviors

- dashboard layout sidebar, navigation active style, login/user block은 변경하지 않았다.
- 추천 과정, 찜한 과정, 캘린더 담기/해제, 날짜 선택, 필터 토글, 월 이동, 프로그램 미리보기 모달 상태 로직은 변경하지 않았다.
- 백엔드, DB, API route, Supabase 계약은 변경하지 않았다.

## Risks / possible regressions

- `/dashboard`는 인증이 필요한 화면이라 로컬 browser check가 로그인 페이지로 리다이렉트되어 실제 authenticated 화면을 눈으로 끝까지 확인하지 못했다.
- 캘린더는 고정 높이와 작은 텍스트 밀도가 높으므로 실제 사용자 데이터가 많은 날의 색 대비와 hover 상태는 추가 육안 확인이 필요하다.

## Verification

- `npm run lint -- --file app/dashboard/page.tsx` from `frontend`: passed.
- `npx tsc --noEmit` from `frontend`: passed.
- Browser smoke on `http://127.0.0.1:3001/dashboard`: redirected to login due missing auth session; no Next error overlay observed on the redirect target.

## Follow-up refactoring candidates

- `frontend/app/dashboard/page.tsx` still contains many inline class strings and direct HEX values; after the visual direction settles, split toolbar, calendar grid, side agenda, and program strip into smaller components.
- Move repeated dashboard surface/button/text classes into shared `iso` helpers or dashboard-local class constants.
