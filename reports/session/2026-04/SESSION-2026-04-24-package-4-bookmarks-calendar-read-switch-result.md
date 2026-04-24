# SESSION-2026-04-24 package 4 bookmarks calendar read switch

## 변경 파일
- `frontend/lib/server/program-card-summary.ts`
- `frontend/lib/server/program-card-summary.test.ts`
- `frontend/lib/program-card-items.ts`
- `frontend/app/api/dashboard/bookmarks/route.ts`
- `frontend/app/api/dashboard/calendar-selections/route.ts`
- `docs/current-state.md`
- `docs/specs/final-refactor-migration-roadmap-v1.md`
- `docs/specs/serializer-api-bff-code-entrypoints-v1.md`
- `docs/refactoring-log.md`

## 왜 변경했는가
- 패키지 4의 첫 read switch 대상으로 가장 안전한 범위가 `bookmarks`와 `calendar-selections`였다.
- 두 BFF는 이미 `ProgramCardItem` 응답 shape는 맞췄지만 내부적으로는 아직 `programs`를 직접 읽고 있어, read model 전환 기준으로는 중간 상태에 머물러 있었다.

## 변경 내용
- `frontend/lib/server/program-card-summary.ts`를 추가해 프로그램 id 목록을 `program_list_index`에서 우선 읽고, 필요한 최소 카드 요약 필드만 `ProgramCardSummary`로 변환하도록 했다.
- read model이 아직 없거나 일부 id가 비어 있으면 해당 경우에만 `programs` direct read로 fallback한다.
- `frontend/app/api/dashboard/bookmarks/route.ts`와 `calendar-selections/route.ts`는 이 helper를 사용하도록 바꿨다.
- `frontend/lib/program-card-items.ts`의 bookmark/selection adapter는 `Program`뿐 아니라 `ProgramCardSummary`도 받을 수 있게 넓혔다.

## 유지한 동작
- 북마크/캘린더 선택 BFF의 외부 응답 shape는 계속 `items: ProgramCardItem[]`다.
- read model이 없는 환경에서도 기존 `programs` fallback으로 카드 조회는 계속 동작한다.
- 카드 순서는 기존 bookmark/selection row 순서를 그대로 유지한다.

## 리스크 / 가능한 회귀
- `program_list_index` row에 없는 필드는 helper가 null로 둔다. 현재 북마크/캘린더 카드가 쓰는 범위에는 맞췄지만, 같은 helper를 다른 화면에 넓힐 때는 필요한 필드를 다시 점검해야 한다.
- 내부 read는 전환됐지만, backend recommendation/compare/detail 쪽 read switch는 아직 남아 있다.

## 검증
- `npm run test -- lib/server/program-card-summary.test.ts lib/server/recommendation-profile.test.ts`
- `npx tsc -p tsconfig.codex-check.json --noEmit`

## 후속 리팩토링 후보
- 패키지 4: backend recommendation/compare read를 `user_recommendation_profile` 우선 구조로 전환
- 패키지 4: 상세/비교 read를 `programs + program_source_records` 조합으로 정리
- 패키지 4: 캘린더 추천 fallback의 direct `programs` read도 read-model-first 구조로 맞추기
