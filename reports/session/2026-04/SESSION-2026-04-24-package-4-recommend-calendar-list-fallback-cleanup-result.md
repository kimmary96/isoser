# SESSION-2026-04-24 package-4 recommend-calendar list fallback cleanup result

## 변경 파일
- `frontend/app/api/dashboard/recommend-calendar/route.ts`
- `frontend/app/api/dashboard/recommend-calendar/route.test.ts`
- `frontend/lib/server/recommend-calendar-fallback.ts`
- `docs/current-state.md`
- `docs/specs/final-refactor-migration-roadmap-v1.md`
- `docs/specs/serializer-api-bff-code-entrypoints-v1.md`
- `docs/refactoring-log.md`

## 왜 변경했는가
- 패키지 4의 추천 BFF cleanup에서 아직 남아 있던 `flat /programs` 계약 의존을 한 단계 더 줄이기 위해서다.
- personalized calendar 추천이 비거나 timeout일 때도 가능한 한 `program_list_index` summary 계약과 가까운 응답을 유지해야 다음 cleanup이 쉬워진다.

## 실제 변경
- `frontend/app/api/dashboard/recommend-calendar/route.ts`의 intermediate backend fallback을 `/programs`에서 `/programs/list`로 전환했다.
- fallback 응답은 `ProgramListPageResponse.items`만 풀어 사용하고, `promoted_items`는 섞지 않는다.
- 순수 helper `frontend/lib/server/recommend-calendar-fallback.ts`를 추가해 organic `items` unwrap 규칙을 route 밖으로 뺐다.

## 유지한 동작
- 외부 응답 shape는 계속 `DashboardRecommendCalendarResponse { items: ProgramCardItem[] }`다.
- personalized 추천이 성공하면 기존과 동일하게 그 결과를 우선 쓴다.
- `/programs/list` fallback도 실패하면 마지막 direct Supabase fallback으로 내려가는 안전 장치는 유지했다.

## 리스크 / 가능한 회귀
- backend `/programs/list`가 일시적으로 비정상 응답을 주면 direct Supabase fallback으로 더 빨리 내려갈 수 있다.
- old local cache shape(`programs`) cleanup은 아직 하지 않았기 때문에 transition 흔적은 일부 남아 있다.

## 검증
- `frontend\npm run test -- app/api/dashboard/recommend-calendar/route.test.ts lib/server/program-card-summary.test.ts lib/server/recommendation-profile.test.ts`
- `frontend\npx tsc -p tsconfig.codex-check.json --noEmit`

## 추가 리팩토링 후보
- `use-dashboard-recommendations.ts`의 old local cache shape(`programs`) 점진 제거
- 추천 카드 helper의 legacy `_reason/_score` fallback 범위 축소
- `recommended-programs` BFF와 landing 추천 consumer의 transition-only 경로 정리
