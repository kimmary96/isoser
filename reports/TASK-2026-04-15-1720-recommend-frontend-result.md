# TASK-2026-04-15-1720-recommend-frontend result

## changed files
- `frontend/app/api/dashboard/recommended-programs/route.ts`
- `frontend/app/dashboard/page.tsx`
- `frontend/app/dashboard/profile/_hooks/use-profile-page.ts`
- `frontend/app/dashboard/activities/_hooks/use-activity-detail.ts`
- `frontend/lib/api/app.ts`
- `frontend/lib/types/index.ts`
- `docs/refactoring-log.md`

## why changes were made
- 추천 BFF가 `category`, `region`, `force_refresh` query string을 받아 백엔드 추천 API로 전달하고, 응답의 추천 이유·맞춤 키워드·추천 점수를 카드 표시용 필드로 병합하도록 수정했다.
- 대시보드 추천 섹션에 카테고리 5개, 지역 4개 필터 칩을 추가하고, 단일 필터 기준으로 추천 목록을 다시 불러오도록 구현했다.
- 추천 카드가 기존 D-day, 마감일, 관련도 표시를 유지하면서 추천 이유 2줄, 맞춤 키워드 최대 3개를 안전하게 표시하도록 확장했다.
- 프로필 저장과 활동 저장 성공 시 추천 캐시를 fire-and-forget 방식으로 무효화해 다음 대시보드 진입에서 최신 추천을 받도록 연결했다.
- 현재 브랜치의 `Program` 타입에 추천 전용 필드가 아직 없어 `_reason`, `_fit_keywords`, `_score`를 추가했다.

## preserved behaviors
- 기존 대시보드 캘린더의 `selectedDate` 상태는 필터 변경 시 초기화하지 않는다.
- 기존 카드의 제목, 출처, D-day 배지, 훈련 기간, 신청 마감, 관련도, 외부 링크 구조는 유지했다.
- 추천 이유와 키워드는 값이 없을 때 렌더링하지 않도록 숨김 처리했다.
- 비로그인 상태에서는 BFF가 인증 토큰 없이 백엔드 추천 API를 호출해 기본 추천 목록 기준 필터링이 가능하도록 유지했다.

## risks / possible regressions
- 카테고리/지역 필터는 태스크 제약에 맞춰 단일 선택만 지원하므로, 한 그룹을 선택하면 다른 그룹은 `전체` 상태로 돌아간다.
- 추천 관련 타입 필드는 프런트 전용 확장 필드라서, 다른 곳에서 `Program`을 엄격 비교하는 코드가 추가되면 영향 범위를 다시 점검해야 한다.
- 로컬 `npx tsc --noEmit`는 현재 변경과 무관한 `.next/types/app/programs/[id]/page.ts`의 누락 모듈 오류 때문에 전체 통과하지 못했다.

## follow-up refactoring candidates
- 대시보드의 추천 섹션 로딩/필터 상태를 별도 훅으로 분리하면 `page.tsx`가 더 작아질 수 있다.
- 추천 카드 메타데이터(`_reason`, `_fit_keywords`, `_score`)를 `Program` 확장 타입으로 분리하면 범용 프로그램 타입의 책임을 줄일 수 있다.

## checks
- `npm run lint -- --file app/dashboard/page.tsx --file app/api/dashboard/recommended-programs/route.ts --file app/dashboard/profile/_hooks/use-profile-page.ts --file app/dashboard/activities/_hooks/use-activity-detail.ts --file lib/api/app.ts`
  - 실패. 저장소에 ESLint 초기 설정이 아직 없어 `next lint`가 대화형 설정 프롬프트에서 중단됨.
- `npx tsc --noEmit`
  - 실패. 현재 작업과 무관한 `.next/types/app/programs/[id]/page.ts` generated type reference 오류가 남아 있음.

## Run Metadata

- generated_at: `2026-04-16T11:51:10`
- watcher_exit_code: `0`
- codex_tokens_used: `146,907`

## Git Automation

- status: `merged-main`
- branch: `develop`
- commit: `469cd3f06a5e9e73cefddcf7181afa014948de69`
- note: [codex] TASK-2026-04-15-1720-recommend-frontend 구현 완료. Auto-promoted to origin/main.
