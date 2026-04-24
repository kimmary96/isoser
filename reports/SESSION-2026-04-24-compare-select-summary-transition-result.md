# SESSION-2026-04-24 Compare Select Summary Transition Result

## 변경 파일
- `frontend/lib/types/index.ts`
- `frontend/lib/program-display.ts`
- `frontend/lib/api/backend.ts`
- `frontend/app/(landing)/compare/program-select-modal.tsx`
- `frontend/app/(landing)/compare/page.tsx`
- `frontend/app/(landing)/compare/programs-compare-client.tsx`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## 왜 변경했는가
- compare 선택 모달의 검색 결과와 compare 페이지 하단 추천 카드는 실제로 몇 개의 카드 표시 필드와 `program_id`만 쓰는데도, 내부 상태와 props는 여전히 전체 `Program` row를 들고 있었습니다.
- 이 경로는 최근 구조형 전환 이후에도 `Program` monolith 의존이 남아 있던 대표적인 지점이어서, 작은 수정으로 구조 효과를 크게 낼 수 있는 다음 묶음이었습니다.
- 화면 계약을 한 번에 뒤집지 않고, compare 선택 UI에 필요한 최소 요약 계약을 먼저 도입해 점진적으로 의존 범위를 줄이는 편이 안전했습니다.

## 이번 변경에서 유지한 동작
- compare 선택 모달의 `찜한 프로그램` 탭과 `전체 검색` 탭 동작은 유지했습니다.
- 전체 검색의 query, `deadline` 정렬, `recruiting_only=true` 조건은 그대로 유지했습니다.
- compare 페이지의 3슬롯 URL state, 프로그램 추가/제거 흐름, 하단 추천 카드 표시 방식은 유지했습니다.
- 실제 비교 본문과 상세 batch 조회 경로는 건드리지 않았습니다.

## 리스크 / 가능한 회귀
- 새 `ProgramSelectSummary` adapter가 필요한 필드를 빠뜨리면 compare 선택 카드의 태그나 출처 문구가 비어 보일 수 있습니다.
- compare 선택 경로는 이제 요약 타입만 들고 있으므로, 이후 이 UI가 새 필드를 요구하면 adapter와 타입을 함께 확장해야 합니다.
- 현재는 프론트 내부 상태만 줄인 단계라서, backend `/programs` 응답 자체는 아직 기존 `Program` 기반입니다.

## 검증
- `node frontend\\node_modules\\typescript\\bin\\tsc -p frontend/tsconfig.json --noEmit`

## 추가 리팩토링 후보
- compare 선택 검색 전용 BFF 또는 backend summary 응답을 추가해 네트워크 payload 자체도 더 작게 줄이기
- `ProgramListPageResponse`의 `items`/`promoted_items`도 `ProgramListRowItem` 계열로 전환해 `/programs` 목록과 compare suggestion 경로를 더 정식 계약으로 맞추기
- dashboard `MiniCalendar`와 dashboard calendar section에 남아 있는 date-key/date parsing 중복을 상위 공용 유틸로 정리하기
