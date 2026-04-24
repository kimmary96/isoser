# SESSION-2026-04-24 package-4-program-card-items-legacy-fallback-cleanup result

## Changed files
- `frontend/lib/program-card-items.ts`
- `frontend/lib/program-card-items.test.ts`
- `frontend/app/dashboard/page.tsx`
- `frontend/app/dashboard/_hooks/use-dashboard-calendar.ts`
- `frontend/app/dashboard/_components/dashboard-calendar-section.tsx`
- `docs/current-state.md`
- `docs/refactoring-log.md`

## Why changes were made
- 패키지 4의 남은 frontend cleanup으로, `ProgramCardItem` 중앙 helper가 새 `context`/summary 계약보다 예전 private 필드를 먼저 섞어 읽을 가능성을 줄였다.
- 새 구조가 있는 경우에는 새 구조를 우선 쓰고, 오래된 `_reason/_fit_keywords/_score/_relevance_score`는 structured recommendation context가 없는 stale payload에서만 읽도록 경계를 좁혔다.
- `/dashboard` 하단 추천 카드와 dashboard calendar hook/card도 중앙 score/reason helper를 재사용하게 바꿔 같은 카드 데이터가 화면별로 다른 점수·사유 우선순위로 보일 가능성을 줄였다.

## Preserved behaviors
- 추천/캘린더/북마크/선택 카드의 공개 입력 타입 `ProgramCardItem`은 유지된다.
- context가 없는 오래된 payload는 여전히 legacy private 필드로 점수와 사유를 읽을 수 있다.
- dashboard와 landing 카드, dashboard calendar의 현재 렌더링 흐름은 유지된다.

## Risks / possible regressions
- 추정: 만약 브라우저 어딘가에 `context`는 있지만 `reason/score`가 비어 있고 private 필드만 남아 있는 특이한 오래된 payload가 있다면, 예전보다 private 필드 의존이 줄어들 수 있다.
- 다만 현재 저장소에서 그런 생산 경로는 확인되지 않았다.

## Follow-up refactoring candidates
- `frontend/lib/types/index.ts`의 `Program`에서 `_reason/_fit_keywords/_score/_relevance_score` 제거 시점 판단
- 카드 consumer에서 `context` 없이 직접 `Program` score/reason을 읽는 남은 경로 추가 축소
