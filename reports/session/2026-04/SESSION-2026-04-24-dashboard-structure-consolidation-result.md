# SESSION-2026-04-24 Dashboard Structure Consolidation Result

## 변경 파일
- `frontend/lib/program-card-items.ts`
- `frontend/app/api/dashboard/recommended-programs/route.ts`
- `frontend/app/api/dashboard/recommend-calendar/route.ts`
- `frontend/app/api/dashboard/bookmarks/route.ts`
- `frontend/app/api/dashboard/calendar-selections/route.ts`
- `frontend/app/dashboard/_hooks/use-dashboard-recommendations.ts`
- `frontend/app/dashboard/_components/dashboard-program-cards.tsx`
- `frontend/app/dashboard/page.tsx`
- `frontend/app/dashboard/_components/dashboard-calendar-section.tsx`
- `frontend/app/(landing)/programs/program-card.tsx`
- `frontend/app/(landing)/programs/program-utils.ts`
- `frontend/lib/types/index.ts`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## 왜 변경했는가
- 추천, 캘린더, 북마크, 적용 일정 BFF가 각각 `ProgramCardItem` 변환 규칙을 따로 들고 있어 같은 계산이 여러 곳에 복제되어 있었습니다.
- `frontend/app/dashboard/page.tsx`가 데이터 로딩, 필터 상태, 북마크/캘린더 저장, 카드 렌더링까지 모두 떠안고 있어 이후 전환 작업을 계속 붙이기 어려운 상태였습니다.
- 대시보드 전환이 이미 `ProgramCardItem` 중심으로 바뀌었는데도, 프런트 타입에는 예전 추천 전용 별칭 타입이 남아 구조 전환 효과를 흐리고 있었습니다.

## 이번 변경에서 유지한 동작
- 추천/캘린더/북마크/적용 일정 응답은 계속 `ProgramCardItem` 기반으로 동작합니다.
- 추천 카드의 점수, 이유, 적합 키워드, 마감일 표시 규칙은 기존과 같은 값을 우선 사용합니다.
- 적용 캘린더의 로컬 저장, 서버 저장, 초기화 흐름은 유지합니다.
- 북마크와 적용 일정의 최대 개수 제한, 비어 있는 상태 문구, 로딩 스켈레톤은 유지합니다.

## 리스크 / 가능한 회귀
- 공용 adapter가 잘못 계산하면 추천/캘린더/북마크 카드가 한 번에 같은 방식으로 어긋날 수 있습니다.
- `dashboard/page.tsx`에서 hook으로 상태를 옮기면서 브라우저 캐시나 로컬 저장소 fallback 타이밍이 미세하게 달라질 수 있습니다.
- 제거된 legacy 타입을 외부에서 아직 참조하고 있었다면 이후 다른 파일에서 타입 오류가 새로 드러날 수 있습니다.

## 검증
- `node frontend\\node_modules\\typescript\\bin\\tsc -p frontend/tsconfig.json --noEmit`

## 추가 리팩토링 후보
- `frontend/app/(landing)/programs`와 `frontend/app/dashboard` 카드 포맷터의 날짜/라벨 변환도 공용 유틸로 더 모으기
- `frontend/lib/types/index.ts`의 거대한 `Program` 타입을 화면 계약 타입 기준으로 단계 분리하기
- 대시보드 추천 hook의 localStorage 키와 캐시 구조를 별도 모듈로 분리해 테스트 범위를 더 좁히기
