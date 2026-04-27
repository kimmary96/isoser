# SESSION-2026-04-24 Program Display And Transition Alias Result

## 변경 파일
- `frontend/lib/program-display.ts`
- `frontend/lib/program-card-items.ts`
- `frontend/lib/types/index.ts`
- `frontend/app/(landing)/programs/program-utils.ts`
- `frontend/app/(landing)/programs/program-card.tsx`
- `frontend/app/(landing)/programs/recommended-programs-section.tsx`
- `frontend/app/(landing)/compare/program-select-modal.tsx`
- `frontend/app/dashboard/_components/dashboard-program-cards.tsx`
- `frontend/app/dashboard/_components/dashboard-calendar-section.tsx`
- `frontend/app/dashboard/page.tsx`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## 왜 변경했는가
- landing 카드, dashboard 카드, calendar 카드, compare 모달이 각각 날짜/마감/출처/링크/id 표시 함수를 따로 들고 있어 같은 규칙이 여러 파일에 중복되어 있었습니다.
- 과도기 화면들은 `Program | ProgramCardSummary` union을 파일마다 반복해 쓰고 있어, 구조 전환이 진행될수록 타입 의도가 더 읽기 어려워지고 있었습니다.
- 이미 `ProgramCardItem` 중심으로 움직이는 화면에서는 `Program` 전체 타입보다 “카드 화면에서 허용되는 과도기 입력”을 명시하는 별도 이름이 필요했습니다.

## 이번 변경에서 유지한 동작
- 추천 카드, 캘린더 카드, 북마크 카드, compare 선택 모달의 기존 라벨과 링크 동작은 유지했습니다.
- `ProgramCardItem` 기반 BFF 응답 구조와 dashboard 추천/북마크/캘린더 전환 경로는 그대로 유지했습니다.
- landing 추천 섹션의 로그인 여부 분기와 추천 필터 기준도 그대로 유지했습니다.

## 리스크 / 가능한 회귀
- 공용 표시 유틸이 잘못 계산하면 여러 카드 화면에서 같은 형식 문제가 동시에 보일 수 있습니다.
- `ProgramCardRenderable` 전이 타입은 과도기용이라, 이후 실제 소비 경로가 더 정리되면 다시 더 좁혀야 합니다.
- compare 모달은 검색 결과는 여전히 `Program` 전체 row를 받기 때문에, 그 경로는 아직 완전한 카드 계약 분리가 아닙니다.

## 검증
- `node frontend\\node_modules\\typescript\\bin\\tsc -p frontend/tsconfig.json --noEmit`

## 추가 리팩토링 후보
- `compare` 검색 결과도 `ProgramListRow` 또는 별도 선택 모달 전용 summary 타입으로 줄이기
- `MiniCalendar`와 dashboard calendar가 공유하는 date-key 계산을 더 상위 공용 유틸로 올리기
- `Program` monolith에서 카드 화면이 전혀 쓰지 않는 필드를 더 분리해 read-model 타입과 원본 타입 경계를 명확히 하기
