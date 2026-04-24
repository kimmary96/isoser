# Programs Filter Scoped Closing Soon Result

## Changed files
- `frontend/app/(landing)/programs/page.tsx`
- `docs/current-state.md`
- `docs/refactoring-log.md`
- `reports\ad-hoc\programs\programs-filter-scoped-closing-soon-result.md`

## Why changes were made
- 필터를 적용해도 `/programs` 상단의 Closing Soon 레일은 전역 마감임박 목록을 조회하고 있어, 사용자가 선택한 조건과 다른 프로그램이 바로 아래에 섞여 보일 수 있었다.
- 목록, 카운트, Closing Soon 조회가 같은 필터 기준을 공유하도록 `currentFilterParams`를 만들고 재사용했다.
- Closing Soon 안내 문구도 현재 검색 조건 기준임을 드러내도록 갱신했다.

## Preserved behaviors
- 전체 프로그램 테이블의 검색, 카테고리, 지역, 수업 방식, 비용, 참여 시간, 운영 기관, 추천 대상, 정렬, 페이지네이션 흐름은 유지했다.
- Closing Soon 레일은 계속 모집중 프로그램만 마감 임박순으로 가져오고, 최근 마감 포함 토글을 켜도 레일에는 마감된 프로그램을 섞지 않는다.
- urgent card의 중복 chip key 방어 로직은 유지했다.

## Risks / possible regressions
- 필터 조합이 매우 좁으면 Closing Soon 레일이 숨겨질 수 있다. 이는 전역 추천을 보여주던 이전 동작과 다른 사용자 경험이다.
- 비용/참여 시간 필터는 기존처럼 백엔드 추론 기반 후처리를 포함하므로, 원본 데이터가 비어 있거나 모호한 공고는 필터 결과에서 빠질 수 있다.

## Follow-up refactoring candidates
- 목록, 카운트, 마감임박 조회에 쓰는 필터 파라미터 타입을 별도 helper로 분리하면 이후 필터 추가 시 누락 위험을 줄일 수 있다.
- 운영 DB의 `cost_type`, `participation_time`, `category_detail` 채움률을 점검해 추론 기반 필터의 불확실성을 줄일 수 있다.

