# SESSION-2026-04-24 compare-summary-read-model-followup result

## changed files
- `frontend/lib/api/backend.ts`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## why changes were made
- compare 검색 BFF와 compare 페이지 추천 카드는 이미 `ProgramSelectSummary`만 쓰고 있었지만, 내부적으로는 여전히 raw `/programs` 응답을 받아 다시 줄이고 있었다.
- 바로 앞 턴에 `/programs/list` summary 계약이 정리됐기 때문에, compare 요약 조회도 같은 summary 경로를 타게 바꾸는 것이 가장 작은 다음 단계였다.

## preserved behaviors
- compare 검색 탭의 query, limit, sort, 모집중 필터, 결과 카드 표시 방식은 그대로 유지된다.
- compare 페이지 하단 추천 카드도 계속 `ProgramSelectSummary`만 사용한다.
- promoted browse layer는 compare 요약 경로에 섞지 않고 organic `items`만 사용한다.

## risks / possible regressions
- `/programs/list` 응답이 예상보다 비어 있으면 compare 추천/검색 결과가 줄어들 수 있다.
- compare summary 경로가 이제 list summary 필드에 더 직접 의존하므로, 이후 `ProgramListRow` 필드 변경 시 compare 선택 카드도 같이 확인해야 한다.

## verification
- `node frontend\\node_modules\\typescript\\bin\\tsc -p frontend/tsconfig.json --noEmit`

## follow-up refactoring candidates
- compare 전용 backend summary endpoint를 추가해 Next.js BFF 내부 downcast도 줄이기
- compare suggestions 경로에 selection/bookmark 문맥을 붙일 전용 item contract가 필요한지 검토하기
