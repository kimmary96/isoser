# SESSION-2026-04-24 Profile Target Job And Surface Cleanup

## changed files
- `frontend/lib/normalizers/profile.ts`
- `frontend/lib/normalizers/profile.test.ts`
- `frontend/app/api/dashboard/profile/route.ts`
- `frontend/app/dashboard/profile/_hooks/use-profile-page.ts`
- `frontend/app/dashboard/profile/_components/profile-edit-modal.tsx`
- `frontend/app/dashboard/profile/_components/profile-hero-section.tsx`
- `frontend/app/dashboard/profile/page.tsx`
- `frontend/lib/server/recommendation-profile.ts`
- `frontend/lib/server/recommendation-profile.test.ts`
- `frontend/lib/program-card-items.ts`
- `frontend/lib/program-card-items.test.ts`
- `frontend/lib/program-display.ts`
- `frontend/app/(landing)/programs/program-card.tsx`
- `frontend/app/(landing)/programs/page.tsx`
- `frontend/app/(landing)/landing-c/_program-utils.ts`
- `frontend/app/(landing)/compare/program-select-modal.tsx`
- `frontend/lib/api/backend.ts`
- `frontend/lib/types/index.ts`
- `docs/current-state.md`
- `docs/refactoring-log.md`
- `docs/specs/program-recommendation-backend-touchpoints-v1.md`
- `docs/specs/serializer-api-bff-transition-plan-v1.md`
- `docs/specs/serializer-api-bff-code-entrypoints-v1.md`
- `docs/specs/user-recommendation-schema-v1.md`
- `docs/specs/user-recommendation-schema-migration-plan-v1.md`

## why changes were made
- 프로필 화면에서 보이는 `희망 직무`와 실제 저장 필드가 어긋나 있던 문제를 줄이기 위해, UI와 저장 경로를 `target_job`과 `bio`로 분리했다.
- 추천 카드 helper가 오래된 private field에 기대지 않도록 `ProgramSurfaceContext`와 정본 summary 값만 읽게 고정했다.
- landing/compare가 비용, 지원 유형, 훈련 형태, 평점 같은 표시 규칙을 한 곳에서 재사용하게 만들어 같은 프로그램이 화면마다 다르게 보일 위험을 줄였다.
- 현재 코드와 맞지 않는 current-state/spec 문서를 함께 갱신해 다음 세션이 잘못된 전제로 시작하지 않게 했다.

## preserved behaviors
- 구형 profile row에는 `target_job`이 비어 있을 수 있으므로, 읽기 경로에서는 계속 `bio` fallback을 유지한다.
- profile 저장 뒤 `refresh_user_recommendation_profile()` 호출과 recommendation cache invalidation 흐름은 유지한다.
- compare/landing의 카드 표시 자체는 유지하면서, 값 해석만 공용 helper로 모았다.
- `listPrograms()` legacy fallback과 `programs` fallback read는 그대로 남겨 미적용 환경 호환성을 유지했다.

## risks / possible regressions
- profile modal에서 `희망 직무`와 `한 줄 소개` 입력이 분리되면서, 기존 사용자가 한 칸에 함께 적어두던 습관과는 달라질 수 있다.
- `ProgramSurfaceContext`가 없는 매우 오래된 추천 payload는 이제 private field를 몰래 읽지 않으므로, 추천 사유/배지가 비어 보일 수 있다.
- `support_type`를 compare selection summary에 직접 담으면서, upstream summary 누락 환경에서는 기존보다 “정보 없음”이 더 빨리 드러날 수 있다.

## follow-up refactoring candidates
- `ProgramCardRenderable = ProgramCardSummary | Program` 전이 별칭을 더 줄여 카드/선택 화면의 `Program` 의존을 계속 축소
- `program-display.ts`에 남아 있는 `compare_meta` fallback을 summary/detail 계약이 더 안정된 뒤 단계적으로 축소
- `listPrograms()` legacy fallback과 남은 `programs` direct fallback을 실제 사용 지점 기준으로 정리
